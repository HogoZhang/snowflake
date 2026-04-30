import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Notification } from 'electron'
import { join } from 'node:path'

import type { ShortcutAction } from '@shared/schema'
import { createApplicationServices, createDialogSelectors, registerIpcHandlers } from './runtime'
import { createMainWindow } from './window'

const services = createApplicationServices(join(app.getPath('userData'), 'data'), app.getVersion())

if (process.env.NODE_ENV === 'production') {
  app.setAppUserModelId('com.cursor.snowflake')
}

function navigateToRoute(route: string): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('shortcut:navigate', route)
  }
}

function triggerAction(action: ShortcutAction): void {
  services.loggerService.info('Shortcut', `Shortcut triggered: ${action}`)

  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('shortcut:action', action)
  }
}

services.shortcutService.setCallback({
  onAction: (action) => {
    const route = services.shortcutService.getActionRoute(action)
    if (route) {
      navigateToRoute(route)
    } else {
      triggerAction(action)
    }
  }
})

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

  if (!Notification.isSupported()) {
    services.loggerService.warn('Notification', 'System notifications are not supported')
  }

  services.shortcutService.setRegistry({
    register: (accelerator, callback) => globalShortcut.register(accelerator, callback),
    unregister: (accelerator) => globalShortcut.unregister(accelerator),
    unregisterAll: () => globalShortcut.unregisterAll()
  })

  services.shortcutService.refreshRegistry()

  services.loggerService.info('App', 'Application initialized', {
    version: app.getVersion(),
    platform: process.platform
  })

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

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  services.loggerService.info('App', 'Application quitting')
})
