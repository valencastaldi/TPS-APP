"""Corrector ortográfico offline (español) para las notas del piletero.

Usa pyspellchecker. Corrige palabra por palabra de forma conservadora:
  - prioriza agregar tildes faltantes (el error más común): si existe un
    candidato que es la misma palabra solo con acentos, lo usa.
  - para otros typos elige el candidato que conserva más la raíz (prefijo
    común más largo), no el más frecuente, para evitar cambiar de palabra.
  - nunca toca números, signos, palabras cortas (<=2) ni la whitelist.
El resultado siempre lo revisa un humano en el dashboard antes de enviar.
"""
import re
import logging
import unicodedata
from functools import lru_cache

logger = logging.getLogger("poolpay.spellcheck")

# Palabras que no queremos corregir (productos, marcas, jerga del rubro)
_WHITELIST = {
    "ph", "cloro", "alguicida", "clarificante", "skimmer", "ok", "wsp", "filtro",
}

_TOKEN_RE = re.compile(r"[^\W\d_]+", re.UNICODE)  # solo letras (con acentos)


@lru_cache(maxsize=1)
def _checker():
    from spellchecker import SpellChecker
    return SpellChecker(language="es")


def _strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def _match_case(original: str, corrected: str) -> str:
    if original.isupper():
        return corrected.upper()
    if original[:1].isupper():
        return corrected[:1].upper() + corrected[1:]
    return corrected


def _dedupe_fix(low: str, sp) -> str | None:
    """Si la palabra tiene una letra repetida de más (ej 'cloroo'),
    prueba quitar una y devuelve el resultado solo si es una palabra real."""
    for i in range(1, len(low)):
        if low[i] == low[i - 1]:
            cand = low[:i] + low[i + 1:]
            if cand in sp:
                return cand
    return None


def _best_candidate(low: str, sp) -> str | None:
    """Solo correcciones SEGURAS: agregar tildes o quitar una letra repetida.
    Nunca cambia una palabra por otra distinta (evita corromper conjugaciones)."""
    cands = sp.candidates(low) or set()
    # 1) Misma palabra pero con tildes (error más común en español)
    for c in cands:
        if c != low and _strip_accents(c) == _strip_accents(low):
            return c
    # 2) Letra repetida de más
    return _dedupe_fix(low, sp)


def correct_text(text: str) -> str:
    """Devuelve el texto con la ortografía corregida. No falla nunca:
    si algo sale mal, devuelve el texto original."""
    if not text or not text.strip():
        return text or ""

    try:
        sp = _checker()
    except Exception as e:  # pragma: no cover
        logger.warning("[spellcheck] no se pudo inicializar: %s", e)
        return text

    def _fix(match: re.Match) -> str:
        word = match.group(0)
        low = word.lower()
        if len(word) <= 2 or low in _WHITELIST or low in sp:
            return word
        corrected = _best_candidate(low, sp)
        if not corrected or corrected == low:
            return word
        return _match_case(word, corrected)

    try:
        return _TOKEN_RE.sub(_fix, text)
    except Exception as e:  # pragma: no cover
        logger.warning("[spellcheck] error corrigiendo: %s", e)
        return text
