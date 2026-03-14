import { describe, expect, it } from 'vitest';
import {
  mergeOpenAIToolCallDeltas,
  type OpenAIToolCallMessage,
} from '@/src/services/ai/streamRequest';

describe('mergeOpenAIToolCallDeltas', () => {
  it('merges indexed tool call chunks into a single executable call', () => {
    const merged = mergeOpenAIToolCallDeltas([], [
      {
        index: 0,
        id: 'call_1',
        function: {
          name: 'manager_prepare_task_intake',
        },
      },
      {
        index: 0,
        function: {
          arguments: '{"sourceText":"Analyze Arsenal vs Chelsea"',
        },
      },
      {
        index: 0,
        function: {
          arguments: ',"language":"en"}',
        },
      },
    ]);

    expect(merged).toEqual<OpenAIToolCallMessage[]>([
      {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'manager_prepare_task_intake',
          arguments: '{"sourceText":"Analyze Arsenal vs Chelsea","language":"en"}',
        },
      },
    ]);
  });

  it('keeps tool calls when a provider omits index from later chunks', () => {
    const merged = mergeOpenAIToolCallDeltas([], [
      {
        id: 'call_missing_index',
        function: {
          name: 'manager_prepare_task_intake',
        },
      },
      {
        function: {
          arguments: '{"sourceText":"Analyze Real Madrid vs Barcelona"',
        },
      },
      {
        function: {
          arguments: ',"language":"en"}',
        },
      },
    ]);

    expect(merged).toEqual<OpenAIToolCallMessage[]>([
      {
        id: 'call_missing_index',
        type: 'function',
        function: {
          name: 'manager_prepare_task_intake',
          arguments: '{"sourceText":"Analyze Real Madrid vs Barcelona","language":"en"}',
        },
      },
    ]);
  });
});
