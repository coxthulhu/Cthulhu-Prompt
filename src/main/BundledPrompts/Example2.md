---
title: "Example: Define Example Prompts in Files"
---
Today, we want to change the way we define our example prompts.
1. Rather than have these be defined in the code, we want to define them in a static folder.
2. We should start storing these example prompts in `src/main/BundledPrompts` as a series of `.md` files.
3. Use frontmatter to store the example prompt's title.
4. We'll need to set up Vite so that it can import these in the code.
5. Just migrate the two existing example prompts to their own files.
6. For order, just define that in the code. We only really need the files to contain the title and text.
