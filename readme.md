# Line Breaker

Annoyed of having to repeatedly press enter and backspace all the time? Line Breaker plugin will make keeping markdown pretty comfier. One enter press and you’ll be writing the next paragraph, one backspace press and you’ll get rid of trailing spaces.

## Features

- Enter
    - Begin / End of H, P, HR: makes two line breaks.
    - In the middle of H or P: breaks the line in two adding one blank line above and below removing spaces or tabs before or after the caret.
    - In a blank line between any kind of blocks (except it only has space or tabs) it makes a blank line above and below.
    - It ignores: Lists, quotes, callouts, footnotes, code blocks, math blocks, tables.
- Shift + Enter
    - Begin / End of H, P, HR: Obsidian default enter behavior.
    - Begin / End of lists, quotes, callouts, footnotes: make two line breaks.
    - In the middle of lists, quotes, callouts, footnotes: breaks the line in two adding one blank line above and below removing spaces or tabs before or after the caret.
    - It ignores: Code blocks, math blocks, tables
- Backspace
    - On a blank line (even it if has spaces or tabs) removes all blank lines above except one even if they had spaces or tabs.
    - On a blank line if there are no blank lines above then joins the above and below line separating them with a space.
    - Beginning of any block if there are more than one blank lines above removes all blank lines above except one even if they had spaces or tabs
    - Beginning of any block if there are no blank lines above then joins the above and below line separating them with a space but removing any other spaces or tabs if any.
- Shift + Backspace
    - Obsidian default backspace behavior.

## Support me!


**[Ko-fi](https://ko-fi.com/elisianw)**