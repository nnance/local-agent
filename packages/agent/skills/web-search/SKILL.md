---
name: web-search
description: >
  Search the web for information. Use when you need
  to find current information, documentation, or
  answers from the internet.
scripts:
  - name: search
    path: scripts/search.sh
    description: >
      Search the web using a query string and return results.
    parameters:
      type: object
      properties:
        query:
          type: string
          description: The search query
      required:
        - query
---

# Web Search

Searches the web using a query string. This is a placeholder implementation
that can be connected to a search API. Currently uses curl to fetch search
results.
