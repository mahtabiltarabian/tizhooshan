// Stylesheets imported by the app's screen files that some adapters reach;
// at run time they load as empty class maps (ignore-css.ts).
declare module "*.css" {
  const classes: Record<string, string>;
  export default classes;
}
