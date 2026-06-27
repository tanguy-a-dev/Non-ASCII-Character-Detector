# Non-ASCII-Character-Detector

Code created to be a chrome extension.

Detects non-ASCII characters on any webpage using the pattern [^\x00-\x7FàçèéêëôïîùûüÀÇÈÉÊËÎÏÔÙÛÜ€$©]. The characters like curly quotes, em dashes, ellipses, are commonly inserted by AI language models. Not a definitive signal, but a useful one.

Highlights matches in-page, lets you navigate between occurrences, and works on SPAs and Gmail.