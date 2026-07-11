Queue of not-yet-published blog posts. The `Daily Blog Post` GitHub Actions
workflow (`.github/workflows/daily-blog-post.yml`) publishes the
lowest-numbered file here once a day: it stamps today's date into the
front matter, moves the file into `_posts/`, and pushes.

To add posts to the queue, drop a new file here named `NNN-slug.md`,
one higher than the current highest number, using this front matter:

```
---
title: "Post Title"
date: 0000-00-00
summary: "One or two sentence teaser."
tags: [Tag One, Tag Two]
---
```

The `date: 0000-00-00` placeholder is required — the workflow replaces
it with the actual publish date via a literal string match. Body content
follows the same Markdown conventions as `_posts/` (##### subheadings,
fenced code blocks, a closing list).

If this directory runs empty, the workflow opens a GitHub issue titled
"Blog post queue is empty" instead of failing — refill it to resume
daily publishing.
