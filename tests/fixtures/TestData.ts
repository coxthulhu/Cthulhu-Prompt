/**
 * ===========================
 * PROMPT DATA TEMPLATES
 * ===========================
 */

/**
 * Collection of sample prompts for different testing scenarios
 */
export const samplePrompts = {
  simple: {
    id: 'simple-1',
    title: 'Simple Greeting',
    promptText: 'Hello, how can I help you today?',
    creationDate: '2023-01-01T10:00:00.000Z',
    lastModifiedDate: '2023-01-01T10:00:00.000Z'
  },
  complex: {
    id: 'complex-1',
    title: 'Complex Code Analysis',
    promptText:
      'Please analyze this code:\n\n```javascript\nfunction calculateSum(arr) {\n  return arr.reduce((acc, val) => acc + val, 0);\n}\n```\n\nConsider:\n1. Performance implications\n2. Error handling\n3. Type safety\n4. Edge cases',
    creationDate: '2023-01-01T11:00:00.000Z',
    lastModifiedDate: '2023-01-01T11:30:00.000Z'
  }
}

/**
 * Height estimation test prompts with predictable line counts
 * Using short lines to avoid word wrapping complications
 */
export const heightTestPrompts = {
  singleLine: {
    id: 'height-test-1',
    title: 'Single Line Prompt',
    promptText: 'One line',
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  },
  threeLine: {
    id: 'height-test-2',
    title: 'Three Line Prompt',
    promptText: 'Line 1\nLine 2\nLine 3',
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  },
  tenLine: {
    id: 'height-test-3',
    title: 'Ten Line Prompt',
    promptText: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10',
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  },
  twentyLine: {
    id: 'height-test-9',
    title: 'Twenty Line Prompt',
    promptText: Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n'),
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  },
  twentyFiveLine: {
    id: 'height-test-4',
    title: 'Twenty Five Line Prompt',
    promptText:
      'L1\nL2\nL3\nL4\nL5\nL6\nL7\nL8\nL9\nL10\nL11\nL12\nL13\nL14\nL15\nL16\nL17\nL18\nL19\nL20\nL21\nL22\nL23\nL24\nL25',
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  },
  fortyLine: {
    id: 'height-test-10',
    title: 'Forty Line Prompt',
    promptText: Array.from({ length: 40 }, (_, i) => `Line ${i + 1}`).join('\n'),
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  },
  emptyLines: {
    id: 'height-test-5',
    title: 'Prompt With Empty Lines',
    promptText: 'Line 1\n\nLine 3\n\nLine 5',
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  },
  fiftyLine: {
    id: 'height-test-6',
    title: 'Fifty Line Prompt',
    promptText: Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join('\n'),
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  },
  hundredLine: {
    id: 'height-test-7',
    title: 'Hundred Line Prompt',
    promptText: Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n'),
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  },
  twoHundredLine: {
    id: 'height-test-8',
    title: 'Two Hundred Line Prompt',
    promptText: Array.from({ length: 200 }, (_, i) => `L${i + 1}`).join('\n'),
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  },
  longWrappedSingleLine: {
    id: 'height-test-11',
    title: 'Wrapped Single Line Prompt',
    promptText: 'W'.repeat(500),
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  },
  longWrappedSingleLineOverflow: {
    id: 'height-test-12',
    title: 'Overflowing Wrapped Single Line Prompt',
    promptText: 'Z'.repeat(10000),
    creationDate: '2024-01-01T10:00:00.000Z',
    lastModifiedDate: '2024-01-01T10:00:00.000Z'
  }
}
