import yogi from "@/assets/dc5afdb0fe2b72a63ddddacca5ad7fc1.png.asset.json";
import logo from "@/assets/BJP-Logo-700x394.png.asset.json";
import logoLarge from "@/assets/Logo_of_the_Bharatiya_Janata_Party.svg.webp.asset.json";
import flag from "@/assets/bjp-flag-with-text-1704.png.asset.json";

/** Owner-supplied references. Candidates are never inserted into public config or auto-approved. */
export const REFERENCE_ASSETS = [
  { name: yogi.original_filename, description: "Yogi walking, genuine transparent cutout, 417 × 870", candidate: "yogi", url: yogi.url },
  { name: logo.original_filename, description: "Lotus artwork, genuine transparency, 700 × 394", candidate: "bjp", url: logo.url },
  { name: logoLarge.original_filename, description: "Large lotus artwork, genuine transparency, 1280 × 1371", candidate: "bjp", url: logoLarge.url },
  { name: flag.original_filename, description: "BJP flag artwork with Hindi text, genuine transparency, 2000 × 2000", candidate: "bjp", url: flag.url },
  { name: "Full Narendra Modi Png, Transparent Png - vhv.jpg", description: "Modi waving; flattened JPEG with checkerboard background, NOT transparent" },
  { name: "AllPngFree - Download Free PNG Images.jpg", description: "Yogi waving; flattened JPEG with checkerboard background, NOT transparent" },
  { name: "Yogi aditynath.jpg", description: "Yogi portrait, opaque reference only" },
  { name: "Yogi aditynath - Copy.jpg", description: "Duplicate Yogi portrait, opaque reference only" },
  { name: "HT4QV3haoAAAmg-.webp", description: "Yogi and another person holding a document; event reference only, opaque" },
  { name: "dad172984729456a6c296ca94dc6c3cb_original.webp", description: "Yogi and Modi seated in conversation; event reference only, opaque" },
  { name: "images (7).jpg", description: "Yogi and Modi holding a gift; event reference only" },
  { name: "images (6).jpg", description: "Yogi with two visitors; event reference only" },
  { name: "images (5).jpg", description: "Yogi with visitors presenting a gift; event reference only" },
  { name: "images (4).jpg", description: "Political promotion showing Amit Shah and Suvendu Adhikari; reference only" },
  { name: "bjp-party-cap.jpg", description: "Paper campaign cap on mannequin; catalogue photograph, not enabled" },
  { name: "51nAqDoc1dL._SX679_.jpg", description: "Orange and green BJP baseball cap; catalogue photograph, not enabled" },
  { name: "61RqPhpPIPL._AC_UY1100_.jpg", description: "Man wearing BJP scarf; catalogue photograph with a person, not enabled" },
  { name: "product-jpeg-500x500.webp", description: "Woman wearing BJP scarf; catalogue photograph with a person, not enabled" },
  { name: "chunav-prachar-samagri.jpg", description: "Hanging orange/green BJP scarf; opaque catalogue photograph, not enabled" },
  { name: "pack-of-1-omg-enriched-2-original-imafx3w5sywmbhyc.webp", description: "BJP flag outdoors; opaque product photograph, not enabled" },
  { name: "pngtree-bjp-flag-with-pole-png-image_8330500.png", description: "Flag and pole on flattened checkerboard background; no real alpha, reference only" },
] as const;

// These mapped binaries belong to the source chat project, not the external repository's hosting origin.
export const referenceUrl = (url: string) => new URL(url, "https://id-preview--c8145deb-25b6-47a7-b2da-36518fcf6dba.lovable.app").href;