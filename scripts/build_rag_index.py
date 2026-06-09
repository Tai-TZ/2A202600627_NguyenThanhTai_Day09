"""Build the legal RAG vector index from data/legal/*.md"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.rag.index import build_index, load_documents


def main() -> None:
    docs = load_documents()
    print(f"Found {len(docs)} legal documents in data/legal/")
    if not docs:
        print("ERROR: No markdown files in data/legal/. Add .md files first.")
        sys.exit(1)

    chunks = build_index()
    print(f"Indexed {len(chunks)} chunks → data/index/chunks.pkl")
    print("Done. RAG search is ready.")


if __name__ == "__main__":
    main()
