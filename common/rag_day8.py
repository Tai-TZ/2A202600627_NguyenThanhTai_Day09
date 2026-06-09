"""Bridge to `RAG - Day8/` folder (pipeline từ Day08)."""

import sys
from pathlib import Path

_RAG_DIR = Path(__file__).resolve().parent.parent / "RAG - Day8"
if str(_RAG_DIR) not in sys.path:
    sys.path.insert(0, str(_RAG_DIR))

from index import build_index, load_documents  # noqa: E402
from search import search_legal_knowledge  # noqa: E402

__all__ = ["search_legal_knowledge", "build_index", "load_documents"]
