#!/bin/sh

# Assumes images have been downloaded to ./static/images and scriptn is being run from
# repository root.
#
# Assumes python dependencies have been installed.

# clean artifacts
rm -r tensorflow/image_vectors && \
  rm -r tensorflow/nearest_neighbors && \
  rm static/similarity-by-artwork-id/*.json


source activate 3.5

# build tensorflow/image_vectors
(cd tensorflow && python classify_images.py "../static/images/*")

# build tensorflow/nearest_neighbors
(cd tensorflow && python cluster_vectors.py)

mv tensorflow/nearest_neighbors/* ./static/similarity-by-artwork-id/

