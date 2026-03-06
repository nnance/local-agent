---
name: web
description: >
  Web interactions including fetching URL content and searching the web.
  Use when you need to fetch web pages, API responses, or find information online.
scripts:
  - name: fetch
    path: scripts/fetch.sh
    description: >
      Retrieve content from a URL. Use when you need to
      fetch web pages, API responses, or download content
      from the internet.
    parameters:
      type: object
      properties:
        url:
          type: string
          description: The URL to fetch content from
      required:
        - url

  - name: search
    path: scripts/search.sh
    description: >
      Search the web for information. Use when you need
      to find current information, documentation, or
      answers from the internet.
    parameters:
      type: object
      properties:
        query:
          type: string
          description: The search query
      required:
        - query
---

# Web

Web interaction skills including fetching URL content and searching the web.

## Operations

### Fetch a URL
Fetches content from a URL using curl. Returns the response body to stdout.
Follows redirects and includes a reasonable timeout.

### Search the web
Searches the web using a query string. Uses DuckDuckGo lite as a simple search backend.
Returns top results with titles and links.

## Usage

Choose the appropriate operation based on your needs:

- Use `fetch` to retrieve content from a specific URL
- Use `search` to find information on the web using natural language queries
