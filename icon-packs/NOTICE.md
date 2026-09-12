# Optional icon packs

These files register embedded image assets. No runtime network requests are required for these packs. Import only the packs you need; they are intentionally separate from Finch's core bundle.

AWS, Azure, Google Cloud and Kubernetes PNG assets are taken from the Diagrams resource collection at revision `244007d439ba561e901875eeef144ebfcf0cd937`: https://github.com/mingrammer/diagrams/tree/244007d439ba561e901875eeef144ebfcf0cd937/resources . This is a third-party collection, not a claim to include the latest official vendor releases. See DIAGRAMS-LICENSE.txt. Vendor assets and trademarks remain subject to their owners' terms:

- AWS: https://aws.amazon.com/architecture/icons/
- Azure: https://learn.microsoft.com/azure/architecture/icons/
- Google Cloud: https://cloud.google.com/icons
- Kubernetes: https://github.com/kubernetes/community/tree/main/icons

Simple Icons 16.28.0: https://github.com/simple-icons/simple-icons . See SIMPLE-ICONS-LICENSE.md, SIMPLE-ICONS-DISCLAIMER.md and simple-provenance.json for per-brand source, guidelines and license metadata. Brand colors are preserved.

catalog.json lists every key. Category-qualified keys are canonical (e.g. `aws:compute/application-auto-scaling`); an unambiguous basename is also available (`aws:application-auto-scaling`). Counts include these aliases. AWS rounded variants are provided as upstream assets; imageShape cropping is optional and may crop artwork.

Rebuild: `python scripts/build-icon-packs.py path/to/diagrams.zip path/to/simple-icons`. The ZIP revision and Simple Icons version are recorded in each generated file. The input assets are not fetched by that script.
