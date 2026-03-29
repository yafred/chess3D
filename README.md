## Installation

```sh
npm install
```

## Local Development

```sh
npm run dev
```

## Production Build

```sh
npm run build
```

The production build is written to `dist/` and uses relative asset paths so it can be hosted on GitHub Pages.

## GitHub Pages

This repository includes a workflow that builds and deploys the site to GitHub Pages on pushes to `master`.

To enable it:

1. Open the repository settings on GitHub.
2. Go to `Pages`.
3. Set `Source` to `GitHub Actions`.
4. Push to `master`, or run the `Deploy to GitHub Pages` workflow manually.

After deployment, the app will be available at your repository's GitHub Pages URL.

