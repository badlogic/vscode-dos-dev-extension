import * as vscode from 'vscode';
import { initLog } from './log';
import * as tools from "./tools";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as log from "./log"

export function activate(context: vscode.ExtensionContext) {
	initLog();

	log.info("===== Welcome to DOS development :D =====");

	context.subscriptions.push(vscode.commands.registerCommand('dosdev.installTools', async () => {
		const dosDir = path.join(os.homedir(), ".dos");
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

		vscode.window.withProgress(
			{
				title: `DOS tools installed in ${dosDir}`,
				location: vscode.ProgressLocation.Notification,
				cancellable: false
			}, async (progress, cancelToken) => {
				function sleep(ms: number) {
					return new Promise((resolve) => {
						setTimeout(resolve, ms);
					});
				}
				await sleep(5000);
			}
		);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('dosdev.initProject', async () => {
		if (!vscode.workspace.workspaceFolders) {
			vscode.window.showErrorMessage("Can not init project without an open workspace. Please open a folder first.");
			return;
		}

		const dest = vscode.workspace.workspaceFolders[0].uri.fsPath;
		const files = fs.readdirSync(dest);
		if (files.length) {
			let ignoreNotEmpty = await vscode.window.showInformationMessage("Project folder is not empty. This may override already existing files.\n\nContinue?", "Yes", "No");
			if (ignoreNotEmpty == "No")
				return;
		}

		const dosDir = path.join(os.homedir(), ".dos");
		if (!fs.existsSync(dosDir)) {
			let reinstall = await vscode.window.showInformationMessage("DOS tools not installed. Install?", "Yes", "No");
			if (reinstall == "Yes") {
				await vscode.commands.executeCommand("dosdev.installTools");
			}
		}

		try {
			fs.mkdirSync(path.join(dest, "assets"));
		} catch (e) { }

		const copyRecursiveSync = (src: string, dest: string) => {
			if (!fs.existsSync(src)) return;
			if (fs.statSync(src).isDirectory()) {
				try {
					fs.mkdirSync(dest);
				} catch (e) { }
				fs.readdirSync(src).forEach((childItemName) => {
					copyRecursiveSync(path.join(src, childItemName),
						path.join(dest, childItemName));
				});
			} else {
				fs.copyFileSync(src, dest);
			}
		};

		copyRecursiveSync(path.join(context.extensionPath, "template"), dest);

		vscode.commands.executeCommand("cmake.configure");
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }
