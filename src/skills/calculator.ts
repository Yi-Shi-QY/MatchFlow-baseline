import { FunctionDeclaration, Type } from "@google/genai";

export const calculatorDeclaration: FunctionDeclaration = {
  name: "calculator",
  description: "A simple calculator to perform basic arithmetic operations (add, subtract, multiply, divide). Use this when you need to calculate precise numbers, such as goal differences, expected goals totals, or win probabilities.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      operation: {
        type: Type.STRING,
        description: "The operation to perform: 'add', 'subtract', 'multiply', or 'divide'",
      },
      a: {
        type: Type.NUMBER,
        description: "The first number",
      },
      b: {
        type: Type.NUMBER,
        description: "The second number",
      },
    },
    required: ["operation", "a", "b"],
  },
};

export async function executeCalculator(args: { operation: string; a: number; b: number }): Promise<number> {
  const { operation, a, b } = args;
  switch (operation) {
    case "add":
      return a + b;
    case "subtract":
      return a - b;
    case "multiply":
      return a * b;
    case "divide":
      if (b === 0) throw new Error("Cannot divide by zero");
      return a / b;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}
