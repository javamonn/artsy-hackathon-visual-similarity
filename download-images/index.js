const { request } = require("graphql-request");
const fetch = require("node-fetch");
const R = require("ramda");
const fs = require("fs");
const path = require("path");
const retry = require("async-retry");
const pAll = require("p-all");

const METAPHYSICS_URL = "https://metaphysics-staging.artsy.net/";
const IMAGE_PATH = path.resolve(__dirname, "../static/images");
const ARTIST_IDS = [
  "pablo-picasso",
  "andy-warhol",
  "roy-lichtenstein",
  "sol-lewitt",
  "georges-braque",
  "mark-rothko",
  "willem-de-kooning",
  "camille-pissarro",
  "eugene-delacroix",
  "john-singer-sargent",
  "agnes-martin",
  "claude-monet",
  "paul-cezanne",
  "michelangelo-buonarroti",
  "albrecht-durer",
  "rembrandt-van-rijn",
  "leonardo-da-vinci",
  "edvard-munch",
  "henri-matisse",
  "wassily-kandinsky",
  "katsushika-hokusai",
  "francisco-de-goya",
  "honore-daumier",
  "paul-gauguin",
  "georges-seurat",
  "vincent-van-gogh",
  "francisco-nicolas",
  "juan-garaizabal",
  "gerhard-richter",
  "agenore-fabbri",
  "ennio-morlotti",
  "liz-collins",
  "alberto-magnelli",
  "pierre-bonnard",
  "jesse-mockrin",
  "sara-vide-ericson",
  "eric-n-mack",
  "ella-kruglyanskaya",
  "claire-tabouret",
  "donna-huanca",
  "constantin-brancusi",
  "amy-sherald",
  "isamu-noguchi",
  "guillermo-lorca",
  "johannes-vermeer",
  "auguste-rodin",
  "zhang-huan",
  "yz-kami",
  "alex-becerra"
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
      data.map(artwork => {
        const { id, image } = artwork;
        if (image && image.image_url) {
          return downloadImage(
            {
              artworkId: id,
              outputPath: IMAGE_PATH
            },
            image.image_url
          ).catch(err => {
            // We don't care about errors, move on
            console.error(err);
          });
        } else {
          return Promise.resolve();
        }
      })
    );
  const looper = ({ page, size, artistId }) =>
    retry(
      () =>
        request(METAPHYSICS_URL, artistArtworksQuery({ artistId, size, page })),
      { minTimeout: 100, maxTimeout: 1000 * 10 }
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

pAll(
  ARTIST_IDS.map(artistId => () =>
    artworkPaginator({ maxPage: 100, size: 50, artistId })
  ),
  { concurrency: 3 }
)
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
  });
