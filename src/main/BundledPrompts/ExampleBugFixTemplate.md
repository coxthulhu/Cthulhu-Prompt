---
title: "Example: Bug Fix Template"
---
In this session, we are investigating an issue. Here are the steps you should follow:
1. Read over the relevant code. Try to find a root cause analytically.
    - If you are unable to determine the cause analytically, halt and ask me for further guidance.
2. If I give you the go ahead, you can attempt to determine the root cause by writing and running integration tests.
    - Make sure you can reproduce the issue in the test.
    - You can add logging to the code before running the tests to get more details.
3. After you determine the root cause, launch a subagent to review your analysis. Let me know if the subagent disagrees with your analysis.

After you determine the root cause of the issue, I might ask you to make a fix. If I do:
1. Make the code changes.
    - Keep things simple, write as little code as possible, and avoid defensive programming.
    - Feel free to change existing code, and update variable and function names to match the updated functionality.
2. After your code changes are complete, run the unit and integration tests.
3. Concisely summarize the results of your development. Include a brief mention of any new test cases and your reasoning behind adding them. Let me know if any integration test runs failed during development, and why.

[[PROMPT_TEXT]]
