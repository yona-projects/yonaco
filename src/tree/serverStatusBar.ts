import * as vscode from 'vscode';
import { ServerRegistry } from '../config/serverConfig';

export function createServerStatusBarItem(serverRegistry: ServerRegistry): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = 'yona.server.switch';
  refreshServerStatusBarItem(item, serverRegistry);
  item.show();
  return item;
}

export function refreshServerStatusBarItem(
  item: vscode.StatusBarItem,
  serverRegistry: ServerRegistry,
): void {
  const current = serverRegistry.getCurrent();
  item.text = current ? `$(server) ${current}` : '$(server) Yona: 서버 없음';
  item.tooltip = current ? '클릭해서 Yona 서버 전환' : '클릭해서 Yona 서버 등록';
}
