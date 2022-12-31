import * as vscode from 'vscode';

let log: vscode.OutputChannel;

export function initLog() {
    log = vscode.window.createOutputChannel("DOS dev");
}

export function info(message: string) {
    log.appendLine(message);
}

export function error(message: string) {
    log.appendLine(message);
    throw new Error(message);
}