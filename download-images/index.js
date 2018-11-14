const { request } = require("graphql-request");
const fetch = require("node-fetch");
const R = require("ramda");
const fs = require("fs");
const path = require("path");

const METAPHYSICS_URL = "https://metaphysics-staging.artsy.net/";
const IMAGE_PATH = path.resolve(__dirname, "../static/images");

const artistArtworksQuery = ({ artistId, size, page }) => `{
  artist(id: "${artistId}") {
    artworks (size: ${size}, page: ${page}) {
      id
      image {
        image_url
      }
    }
  }
}`;

const downloadImage = ({ outputPath, artworkId }, imageURL) =>
  fetch(imageURL.replace(":version", "normalized")).then(
    res =>
      new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(
          path.join(outputPath, artworkId + ".jpg")
        );
        dest.on("close", resolve).on("error", reject);
        res.body.pipe(dest);
      })
  );

const processResponse = res =>
  R.pipe(
    R.path(["artist", "artworks"]),
    R.map(({ id, image: { image_url } }) =>
      downloadImage(
        {
          artworkId: id,
          outputPath: IMAGE_PATH
        },
        image_url
      )
    ),
    arr => Promise.all(arr)
  )(data);

const artworkPaginator = ({ maxPage, size, artistId }) => {
  const onData = data =>
    Promise.all(
      data.map(({ id, image: { image_url } }) =>
        downloadImage(
          {
            artworkId: id,
            outputPath: IMAGE_PATH
          },
          image_url
        )
      )
    );
  const looper = ({ page, size, artistId }) =>
    request(
      METAPHYSICS_URL,
      artistArtworksQuery({ artistId, size, page })
    ).then(res => {
      const data = R.pathOr([], ["artist", "artworks"], res);
      return onData(data).then(() => {
        if (data.length < size || page > maxPage) {
          // We're done, stop looping
          return Promise.resolve();
        } else {
          // Keep on looping
          return looper({ page: page + 1, size, artistId });
        }
      });
    });
  return looper({ page: 6, size, artistId });
};

artworkPaginator({ maxPage: 10, size: 100, artistId: "pablo-picasso" })
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
  });
