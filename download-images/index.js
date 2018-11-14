const { request } = require("graphql-request");
const fetch = require("node-fetch");
const R = require("ramda");
const fs = require("fs");
const path = require("path");
const retry = require("async-retry");

const METAPHYSICS_URL = "https://metaphysics-staging.artsy.net/";
const IMAGE_PATH = path.resolve(__dirname, "../static/images");
const ARTIST_IDS = [
  "pablo-picasso",
  "andy-warhol",
  "roy-lichtenstein",
  "sol-lewitt",
  "georges-braque",
  "mark-rothko",
  "willem-de-kooning"
];

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

const artworkPaginator = ({ maxPage, size, artistId }) => {
  const onData = data =>
    Promise.all(
      data.map(({ id, image: { image_url } }) =>
        retry(() =>
          downloadImage(
            {
              artworkId: id,
              outputPath: IMAGE_PATH
            },
            image_url
          )
        )
      )
    );
  const looper = ({ page, size, artistId }) =>
    retry(() =>
      request(METAPHYSICS_URL, artistArtworksQuery({ artistId, size, page }))
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
  return looper({ page: 1, size, artistId });
};

Promise.all(
  ARTIST_IDS.map(artistId =>
    artworkPaginator({ maxPage: 10, size: 100, artistId })
  )
)
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
  });
