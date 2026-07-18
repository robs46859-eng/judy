# Judy RAG Sources and Ingestion

Judy uses a local Retrieval-Augmented Generation (RAG) pipeline to ground its LLM responses in curated knowledge, primarily focused on gay-travel safety, health, events, and destinations.

## Directory Structure
- `data/rag/sources/`: Raw text and JSON data that serves as the knowledge base.
- `data/rag/index/`: The generated chunks and embeddings used at runtime by the retriever.

## Source Formats
The ingestion script supports three formats:
1. `.md`: Markdown files for prose and long-form knowledge (e.g., safety guidelines, travel tips). One topic per paragraph works best for effective chunking.
2. `.txt`: Plain text files, chunked identically to Markdown.
3. `.json`: Structured data format, which must be an array of objects matching this schema:
   ```json
   [
     {
       "id": "unique-id",
       "text": "The main content to index.",
       "metadata": {
         "region": "Europe",
         "tags": ["beach", "resort"]
       }
     }
   ]
   ```

## Managing Sources

### Manual Curation
You can manually add or update files in `data/rag/sources/`. Remember to keep chunks focused and provide context-rich text. Do not include unverified legal absolutes; always frame legal or safety tips as guidance.

### Automatic Feeds
You can automatically fetch external data using the feeds script.
1. Provide the environment variables `RAG_FEEDS_URLS` (comma-separated list of JSON feeds) and optionally `RAG_FEEDS_ALLOWLIST` (comma-separated list of allowed domains).
2. Run `npm run rag:feeds`.
3. The script will fetch the data, deduplicate by `id`, and save it to `data/rag/sources/feed-<hostname>.json`.

## Re-indexing
After adding or modifying sources (either manually or via the feeds script), you must regenerate the index:
```bash
npm run rag:ingest
```
This script chunks the texts, generates embeddings (if `GEMINI_API_KEY` is provided), and writes the output to `data/rag/index/`. The index directory is tracked in Git, so you should commit the updated index files to ensure production instances have the latest knowledge.
