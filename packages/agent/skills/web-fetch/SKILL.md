---
name: web-fetch
description: >
  Retrieve content from a URL. Use when you need to
  fetch web pages, API responses, or download content
  from the internet.
scripts:
  - name: fetch
    path: scripts/fetch.sh
    description: >
      Fetch content from a URL and return it.
    parameters:
      type: object
      properties:
        url:
          type: string
          description: The URL to fetch content from
      required:
        - url
---

# Web Fetch

Fetches content from a URL using curl. Returns the response body to stdout.
Follows redirects and includes a reasonable timeout.
