#!/bin/bash
# Rebuilds the site and pushes to gh-pages branch for GitHub Pages deployment
set -e

echo "Building..."
bun run build

echo "Deploying to gh-pages..."
cd dist
git init --quiet
git checkout -b gh-pages --quiet
touch .nojekyll
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M')" --quiet
git push --force https://github.com/ruchaheda/sankalp.git gh-pages
cd ..

echo "Done! Live at https://ruchaheda.github.io/sankalp/"
