import * as vscode from 'vscode';
import { initLog } from './log';
import * as tools from "./tools";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
	initLog();

	context.subscriptions.push(vscode.commands.registerCommand('dosdev.installTools', async () => {
		let dosDir = path.join(os.homedir(), ".dos");
		if (fs.existsSync(dosDir)) {
			let reinstall = await vscode.window.showInformationMessage("DOS tools exist. Re-install?", "Yes", "No");
			if (reinstall != "Yes") return;
		}

		await vscode.window.withProgress(
			{
				title: "Installing DOS tools",
				location: vscode.ProgressLocation.Notification,
				cancellable: true,

			}, async (progress, cancelToken) => {
				return tools.installTools(context, progress, cancelToken);
			}
		);

		vscode.window.showInformationMessage(`DOS tools installed in ${dosDir}`);
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }
