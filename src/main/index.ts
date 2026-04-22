import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'

import { createApplicationServices, createDialogSelectors, registerIpcHandlers } from './runtime'
import { createMainWindow } from './window'

const services = createApplicationServices(join(app.getPath('userData'), 'data'), app.getVersion())

app.whenReady().then(async () => {
  registerIpcHandlers(
    ipcMain,
    services,
    createDialogSelectors(
      {
        showSaveDialog: (options) => dialog.showSaveDialog(options),
        showOpenDialog: (options) => dialog.showOpenDialog(options)
      },
      app
    )
  )

  await createMainWindow({
    BrowserWindow,
    storage: services.storage
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow({
        BrowserWindow,
        storage: services.storage
      })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
