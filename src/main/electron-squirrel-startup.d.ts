// abstract: Local type declaration for the Squirrel startup helper package.
// out_of_scope: Squirrel event handling, installer creation, and Electron app lifecycle.

declare module "electron-squirrel-startup" {
  const started: boolean;
  export default started;
}
