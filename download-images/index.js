const { request } = require("graphql-request");
const fetch = require("node-fetch");
const R = require("ramda");
const fs = require("fs");
const path = require("path");

const METAPHYSICS_URL = "https://metaphysics-staging.artsy.net/";
const IMAGE_PATH = path.resolve(__dirname, "../static/images");

const artistArtworksQuery = ({ artistId, size }) => `{
  artist(id: "${artistId}") {
    artworks (size: ${size}) {
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

request(
  METAPHYSICS_URL,
  artistArtworksQuery({ artistId: "pablo-picasso", size: 50 })
)
  .then(data =>
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
    )(data)
  )
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
  });
