
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

export interface AnimationTemplate {
  id: string;
  name: string;
  description: string;
  schema: any; // JSON Schema for the params/data prop
  requiredParams: string[];
  example: any; // Example params
  fillParams: (params: any) => any; // Deterministic template fill function
  Component: React.FC<{ data: any }>;
}

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toText = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

// --- Template 1: Stats Comparison (Bar Chart) ---
const StatsComparison: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const homeValue = data.homeValue || 0;
  const awayValue = data.awayValue || 0;
  const maxValue = Math.max(homeValue, awayValue, 1);
  
  const progress = spring({ frame, fps, config: { damping: 15 } });
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', width: '100%', padding: '0 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '60px', fontWeight: 'bold', color: '#10b981' }}>{data.homeLabel}</div>
        <div style={{ fontSize: '40px', color: '#a1a1aa' }}>{data.metric}</div>
        <div style={{ fontSize: '60px', fontWeight: 'bold', color: '#3b82f6' }}>{data.awayLabel}</div>
      </div>
      
      {/* Bars Container */}
      <div style={{ display: 'flex', gap: '20px', height: '60px' }}>
        {/* Home Bar (Right Aligned) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ 
            width: `${(homeValue / maxValue) * 100}%`, 
            background: '#10b981', 
            borderRadius: '10px',
            transform: `scaleX(${progress})`,
            transformOrigin: 'right'
          }} />
        </div>
        
        {/* Divider */}
        <div style={{ width: '4px', background: '#3f3f46' }} />
        
        {/* Away Bar (Left Aligned) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ 
            width: `${(awayValue / maxValue) * 100}%`, 
            background: '#3b82f6', 
            borderRadius: '10px',
            transform: `scaleX(${progress})`,
            transformOrigin: 'left'
          }} />
        </div>
      </div>
      
      {/* Values */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '80px', fontWeight: 'bold' }}>
        <div style={{ opacity: interpolate(frame, [0, 20], [0, 1]) }}>{homeValue}</div>
        <div style={{ opacity: interpolate(frame, [0, 20], [0, 1]) }}>{awayValue}</div>
      </div>
    </div>
  );
};

export const statsTemplate: AnimationTemplate = {
  id: 'stats-comparison',
  name: 'Stats Comparison',
  description: 'Compare two numerical values (e.g., possession, shots) with animated bars.',
  schema: {
    type: 'object',
    properties: {
      homeLabel: { type: 'string' },
      awayLabel: { type: 'string' },
      metric: { type: 'string', description: 'Name of the stat (e.g. "Possession")' },
      homeValue: { type: 'number' },
      awayValue: { type: 'number' }
    },
    required: ['homeLabel', 'awayLabel', 'metric', 'homeValue', 'awayValue']
  },
  requiredParams: ['homeLabel', 'awayLabel', 'metric', 'homeValue', 'awayValue'],
  example: {
    homeLabel: "Man City",
    awayLabel: "Liverpool",
    metric: "Possession (%)",
    homeValue: 65,
    awayValue: 35
  },
  fillParams: (params: any) => ({
    homeLabel: toText(params?.homeLabel, 'Home Team'),
    awayLabel: toText(params?.awayLabel, 'Away Team'),
    metric: toText(params?.metric, 'Metric'),
    homeValue: toNumber(params?.homeValue, 0),
    awayValue: toNumber(params?.awayValue, 0),
  }),
  Component: StatsComparison
};

// --- Template 2: Odds Card ---
const OddsCard: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const enter = spring({ frame, fps, config: { damping: 12 } });
  const had = data.had || { h: 0, d: 0, a: 0 };
  
  return (
    <div style={{ display: 'flex', gap: '40px', width: '100%', justifyContent: 'center', transform: `scale(${enter})` }}>
      <div style={{ background: '#18181b', padding: '40px', borderRadius: '20px', textAlign: 'center', minWidth: '200px', border: '2px solid #10b981' }}>
        <div style={{ fontSize: '30px', color: '#a1a1aa', marginBottom: '10px' }}>{data.homeLabel || 'HOME'}</div>
        <div style={{ fontSize: '60px', fontWeight: 'bold', color: '#fff' }}>{had.h}</div>
      </div>
      <div style={{ background: '#18181b', padding: '40px', borderRadius: '20px', textAlign: 'center', minWidth: '200px', border: '2px solid #71717a' }}>
        <div style={{ fontSize: '30px', color: '#a1a1aa', marginBottom: '10px' }}>DRAW</div>
        <div style={{ fontSize: '60px', fontWeight: 'bold', color: '#fff' }}>{had.d}</div>
      </div>
      <div style={{ background: '#18181b', padding: '40px', borderRadius: '20px', textAlign: 'center', minWidth: '200px', border: '2px solid #3b82f6' }}>
        <div style={{ fontSize: '30px', color: '#a1a1aa', marginBottom: '10px' }}>{data.awayLabel || 'AWAY'}</div>
        <div style={{ fontSize: '60px', fontWeight: 'bold', color: '#fff' }}>{had.a}</div>
      </div>
    </div>
  );
};

export const oddsTemplate: AnimationTemplate = {
  id: 'odds-card',
  name: 'Odds Display',
  description: 'Display 1x2 (Home/Draw/Away) odds prominently.',
  schema: {
    type: 'object',
    properties: {
      had: {
        type: 'object',
        properties: {
          h: { type: 'number' },
          d: { type: 'number' },
          a: { type: 'number' }
        }
      }
    },
    required: ['had']
  },
  requiredParams: ['had.h', 'had.d', 'had.a'],
  example: {
    had: { h: 1.55, d: 4.20, a: 6.50 }
  },
  fillParams: (params: any) => ({
    homeLabel: toText(params?.homeLabel, 'HOME'),
    awayLabel: toText(params?.awayLabel, 'AWAY'),
    had: {
      h: toNumber(params?.had?.h, 0),
      d: toNumber(params?.had?.d, 0),
      a: toNumber(params?.had?.a, 0),
    }
  }),
  Component: OddsCard
};

// --- Template 3: Tactical Board (Simple) ---
const TacticalBoard: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();
  
  return (
    <div style={{ 
      width: '800px', 
      height: '500px', 
      background: '#064e3b', 
      border: '4px solid white', 
      position: 'relative',
      borderRadius: '8px',
      opacity: interpolate(frame, [0, 20], [0, 1])
    }}>
      {/* Center Circle */}
      <div style={{ 
        position: 'absolute', top: '50%', left: '50%', 
        width: '100px', height: '100px', 
        border: '2px solid white', borderRadius: '50%', 
        transform: 'translate(-50%, -50%)' 
      }} />
      <div style={{ 
        position: 'absolute', top: '0', left: '50%', 
        width: '2px', height: '100%', 
        background: 'white', 
        transform: 'translateX(-50%)' 
      }} />
      
      <div style={{ position: 'absolute', top: '20px', left: '20px', color: 'white', fontSize: '24px', fontWeight: 'bold' }}>
        {data.formation || 'Tactical View'}
      </div>
      
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', color: '#a1a1aa', fontSize: '20px' }}>
        {data.note}
      </div>
    </div>
  );
};

export const tacticalTemplate: AnimationTemplate = {
  id: 'tactical-board',
  name: 'Tactical Board',
  description: 'A simple football pitch view for tactical notes.',
  schema: {
    type: 'object',
    properties: {
      formation: { type: 'string' },
      note: { type: 'string' }
    }
  },
  requiredParams: ['formation'],
  example: {
    formation: "4-3-3 Attacking",
    note: "High press line"
  },
  fillParams: (params: any) => ({
    formation: toText(params?.formation, 'Tactical View'),
    note: toText(params?.note, ''),
  }),
  Component: TacticalBoard
};

// --- Template 4: Basketball Metrics Radar (Card Matrix) ---
const BasketballMetricsRadar: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const homeColor = '#f59e0b';
  const awayColor = '#60a5fa';

  const metrics = [
    {
      label: 'Pace',
      home: toNumber(data?.pace?.home, 0),
      away: toNumber(data?.pace?.away, 0),
      unit: '',
    },
    {
      label: 'OffRtg',
      home: toNumber(data?.offensiveRating?.home, 0),
      away: toNumber(data?.offensiveRating?.away, 0),
      unit: '',
    },
    {
      label: 'DefRtg',
      home: toNumber(data?.defensiveRating?.home, 0),
      away: toNumber(data?.defensiveRating?.away, 0),
      unit: '',
    },
    {
      label: 'Reb%',
      home: toNumber(data?.reboundRate?.home, 0),
      away: toNumber(data?.reboundRate?.away, 0),
      unit: '%',
    },
    {
      label: 'TOV%',
      home: toNumber(data?.turnoverRate?.home, 0),
      away: toNumber(data?.turnoverRate?.away, 0),
      unit: '%',
    },
  ];

  return (
    <div
      style={{
        width: '100%',
        padding: '0 42px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        transform: `scale(${enter})`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '44px', fontWeight: 700 }}>
        <div style={{ color: homeColor }}>{toText(data?.homeLabel, 'Home')}</div>
        <div style={{ color: '#d4d4d8', fontSize: '30px', alignSelf: 'center' }}>METRICS</div>
        <div style={{ color: awayColor }}>{toText(data?.awayLabel, 'Away')}</div>
      </div>

      {metrics.map((metric, idx) => {
        const maxValue = Math.max(metric.home, metric.away, 1);
        const homeWidth = `${(metric.home / maxValue) * 46}%`;
        const awayWidth = `${(metric.away / maxValue) * 46}%`;
        const rowFade = interpolate(frame, [idx * 3, idx * 3 + 12], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            key={metric.label}
            style={{
              background: '#111827',
              borderRadius: '14px',
              border: '1px solid #1f2937',
              padding: '12px 16px',
              opacity: rowFade,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e5e7eb', fontSize: '24px' }}>
              <span>{`${metric.home}${metric.unit}`}</span>
              <span style={{ color: '#a1a1aa' }}>{metric.label}</span>
              <span>{`${metric.away}${metric.unit}`}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
              <div style={{ height: '12px', borderRadius: '999px', background: homeColor, width: homeWidth }} />
              <div style={{ width: '2px', height: '18px', background: '#52525b' }} />
              <div style={{ height: '12px', borderRadius: '999px', background: awayColor, width: awayWidth }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const basketballMetricsTemplate: AnimationTemplate = {
  id: 'basketball-metrics-radar',
  name: 'Basketball Metrics Radar',
  description: 'Compare basketball-specific advanced metrics for two teams.',
  schema: {
    type: 'object',
    properties: {
      homeLabel: { type: 'string' },
      awayLabel: { type: 'string' },
      pace: {
        type: 'object',
        properties: { home: { type: 'number' }, away: { type: 'number' } },
      },
      offensiveRating: {
        type: 'object',
        properties: { home: { type: 'number' }, away: { type: 'number' } },
      },
      defensiveRating: {
        type: 'object',
        properties: { home: { type: 'number' }, away: { type: 'number' } },
      },
      reboundRate: {
        type: 'object',
        properties: { home: { type: 'number' }, away: { type: 'number' } },
      },
      turnoverRate: {
        type: 'object',
        properties: { home: { type: 'number' }, away: { type: 'number' } },
      },
    },
    required: ['homeLabel', 'awayLabel', 'pace', 'offensiveRating', 'defensiveRating'],
  },
  requiredParams: [
    'homeLabel',
    'awayLabel',
    'pace.home',
    'pace.away',
    'offensiveRating.home',
    'offensiveRating.away',
    'defensiveRating.home',
    'defensiveRating.away',
  ],
  example: {
    homeLabel: 'Lakers',
    awayLabel: 'Celtics',
    pace: { home: 101.2, away: 98.8 },
    offensiveRating: { home: 116.4, away: 118.1 },
    defensiveRating: { home: 112.8, away: 110.5 },
    reboundRate: { home: 51.4, away: 49.2 },
    turnoverRate: { home: 12.8, away: 11.4 },
  },
  fillParams: (params: any) => ({
    homeLabel: toText(params?.homeLabel, 'Home'),
    awayLabel: toText(params?.awayLabel, 'Away'),
    pace: {
      home: toNumber(params?.pace?.home, 0),
      away: toNumber(params?.pace?.away, 0),
    },
    offensiveRating: {
      home: toNumber(params?.offensiveRating?.home, 0),
      away: toNumber(params?.offensiveRating?.away, 0),
    },
    defensiveRating: {
      home: toNumber(params?.defensiveRating?.home, 0),
      away: toNumber(params?.defensiveRating?.away, 0),
    },
    reboundRate: {
      home: toNumber(params?.reboundRate?.home, 0),
      away: toNumber(params?.reboundRate?.away, 0),
    },
    turnoverRate: {
      home: toNumber(params?.turnoverRate?.home, 0),
      away: toNumber(params?.turnoverRate?.away, 0),
    },
  }),
  Component: BasketballMetricsRadar,
};

// --- Template 5: Basketball Lines Card ---
const BasketballLinesCard: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 12 } });

  const moneyline = {
    home: toNumber(data?.moneyline?.home, 0),
    away: toNumber(data?.moneyline?.away, 0),
  };
  const spread = {
    line: toNumber(data?.spread?.line, 0),
    homePrice: toNumber(data?.spread?.homePrice, 0),
    awayPrice: toNumber(data?.spread?.awayPrice, 0),
  };
  const total = {
    points: toNumber(data?.total?.points, 0),
    overPrice: toNumber(data?.total?.overPrice, 0),
    underPrice: toNumber(data?.total?.underPrice, 0),
  };

  const cardStyle: React.CSSProperties = {
    flex: 1,
    minWidth: '260px',
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '16px',
    padding: '20px',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        transform: `scale(${enter})`,
      }}
    >
      <div style={{ textAlign: 'center', color: '#e5e7eb', fontSize: '42px', fontWeight: 700 }}>
        Basketball Lines
      </div>
      <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
        <div style={cardStyle}>
          <div style={{ color: '#9ca3af', fontSize: '24px', marginBottom: '8px' }}>Moneyline</div>
          <div style={{ color: '#f8fafc', fontSize: '28px' }}>
            {toText(data?.homeLabel, 'Home')}: {moneyline.home}
          </div>
          <div style={{ color: '#f8fafc', fontSize: '28px' }}>
            {toText(data?.awayLabel, 'Away')}: {moneyline.away}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: '#9ca3af', fontSize: '24px', marginBottom: '8px' }}>Spread</div>
          <div style={{ color: '#f8fafc', fontSize: '28px' }}>Line: {spread.line}</div>
          <div style={{ color: '#f8fafc', fontSize: '24px' }}>Home Price: {spread.homePrice}</div>
          <div style={{ color: '#f8fafc', fontSize: '24px' }}>Away Price: {spread.awayPrice}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: '#9ca3af', fontSize: '24px', marginBottom: '8px' }}>Total</div>
          <div style={{ color: '#f8fafc', fontSize: '28px' }}>Points: {total.points}</div>
          <div style={{ color: '#f8fafc', fontSize: '24px' }}>Over: {total.overPrice}</div>
          <div style={{ color: '#f8fafc', fontSize: '24px' }}>Under: {total.underPrice}</div>
        </div>
      </div>
    </div>
  );
};

export const basketballLinesTemplate: AnimationTemplate = {
  id: 'basketball-lines-card',
  name: 'Basketball Lines Card',
  description: 'Display moneyline, spread, and total points for basketball analysis.',
  schema: {
    type: 'object',
    properties: {
      homeLabel: { type: 'string' },
      awayLabel: { type: 'string' },
      moneyline: {
        type: 'object',
        properties: { home: { type: 'number' }, away: { type: 'number' } },
      },
      spread: {
        type: 'object',
        properties: {
          line: { type: 'number' },
          homePrice: { type: 'number' },
          awayPrice: { type: 'number' },
        },
      },
      total: {
        type: 'object',
        properties: {
          points: { type: 'number' },
          overPrice: { type: 'number' },
          underPrice: { type: 'number' },
        },
      },
    },
    required: ['moneyline', 'spread', 'total'],
  },
  requiredParams: [
    'moneyline.home',
    'moneyline.away',
    'spread.line',
    'spread.homePrice',
    'spread.awayPrice',
    'total.points',
    'total.overPrice',
    'total.underPrice',
  ],
  example: {
    homeLabel: 'Lakers',
    awayLabel: 'Celtics',
    moneyline: { home: 1.92, away: 1.88 },
    spread: { line: -2.5, homePrice: 1.9, awayPrice: 1.95 },
    total: { points: 228.5, overPrice: 1.91, underPrice: 1.91 },
  },
  fillParams: (params: any) => ({
    homeLabel: toText(params?.homeLabel, 'Home'),
    awayLabel: toText(params?.awayLabel, 'Away'),
    moneyline: {
      home: toNumber(params?.moneyline?.home, 0),
      away: toNumber(params?.moneyline?.away, 0),
    },
    spread: {
      line: toNumber(params?.spread?.line, 0),
      homePrice: toNumber(params?.spread?.homePrice, 0),
      awayPrice: toNumber(params?.spread?.awayPrice, 0),
    },
    total: {
      points: toNumber(params?.total?.points, 0),
      overPrice: toNumber(params?.total?.overPrice, 0),
      underPrice: toNumber(params?.total?.underPrice, 0),
    },
  }),
  Component: BasketballLinesCard,
};

// --- Template 6: Basketball Matchup Board ---
const BasketballMatchupBoard: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '900px',
        height: '540px',
        borderRadius: '18px',
        border: '2px solid #3f3f46',
        background: 'linear-gradient(135deg, #0f172a 0%, #111827 45%, #1f2937 100%)',
        color: '#f8fafc',
        padding: '28px',
        opacity,
      }}
    >
      <div style={{ fontSize: '42px', fontWeight: 700, marginBottom: '10px' }}>
        {toText(data?.focusArea, 'Primary Matchup Focus')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '20px' }}>
        <div
          style={{
            background: '#111827',
            border: '1px solid #1f2937',
            borderRadius: '12px',
            padding: '18px',
          }}
        >
          <div style={{ color: '#f59e0b', fontSize: '24px', marginBottom: '8px' }}>Home Edge</div>
          <div style={{ fontSize: '32px', fontWeight: 600 }}>
            {toText(data?.homeAdvantage, 'Interior pressure and transition push')}
          </div>
        </div>
        <div
          style={{
            background: '#111827',
            border: '1px solid #1f2937',
            borderRadius: '12px',
            padding: '18px',
          }}
        >
          <div style={{ color: '#60a5fa', fontSize: '24px', marginBottom: '8px' }}>Away Edge</div>
          <div style={{ fontSize: '32px', fontWeight: 600 }}>
            {toText(data?.awayAdvantage, 'Perimeter shot quality and half-court execution')}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: '20px',
          background: '#020617',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '16px',
          color: '#cbd5e1',
          fontSize: '26px',
        }}
      >
        Adjustment Note: {toText(data?.adjustmentNote, 'Monitor lineup substitutions after first rotation.')}
      </div>
    </div>
  );
};

export const basketballMatchupTemplate: AnimationTemplate = {
  id: 'basketball-matchup-board',
  name: 'Basketball Matchup Board',
  description: 'Highlight tactical matchup edges and adjustment notes for basketball games.',
  schema: {
    type: 'object',
    properties: {
      focusArea: { type: 'string' },
      homeAdvantage: { type: 'string' },
      awayAdvantage: { type: 'string' },
      adjustmentNote: { type: 'string' },
    },
    required: ['focusArea', 'homeAdvantage', 'awayAdvantage'],
  },
  requiredParams: ['focusArea', 'homeAdvantage', 'awayAdvantage'],
  example: {
    focusArea: 'Wing shot creation vs point-of-attack containment',
    homeAdvantage: 'Rim pressure with second-chance opportunities',
    awayAdvantage: 'Switch-heavy scheme against primary initiator',
    adjustmentNote: 'Watch weak-side tagging discipline in Q3.',
  },
  fillParams: (params: any) => ({
    focusArea: toText(params?.focusArea, 'Primary Matchup Focus'),
    homeAdvantage: toText(params?.homeAdvantage, 'Home-side tactical edge'),
    awayAdvantage: toText(params?.awayAdvantage, 'Away-side tactical edge'),
    adjustmentNote: toText(params?.adjustmentNote, 'Adjustment note pending'),
  }),
  Component: BasketballMatchupBoard,
};

export const TEMPLATES: Record<string, AnimationTemplate> = {
  'stats-comparison': statsTemplate,
  'odds-card': oddsTemplate,
  'tactical-board': tacticalTemplate,
  'basketball-metrics-radar': basketballMetricsTemplate,
  'basketball-lines-card': basketballLinesTemplate,
  'basketball-matchup-board': basketballMatchupTemplate,
};
