import * as os from "os"
import * as fs from "fs"
import * as fsextra from "fs-extra"
import * as path from "path"
import * as log from "./log"
import * as vscode from "vscode"
import * as process from "process"

import { getApi, FileDownloader } from "@microsoft/vscode-file-downloader-api";
import decompress = require("decompress");
import { createArchiveByFileExtension } from "@shockpkg/archive-files"

async function extractZip(source: string, dest: string) {
    const archive = createArchiveByFileExtension(source);
    if (!archive) throw Error(`Couldn't open ${source}`);
    await archive.read(async entry => {
        await entry.extract(path.join(dest, entry.path));
    });
}

async function downloadTool(url: string, downloader: FileDownloader, context: vscode.ExtensionContext, progress: vscode.Progress<{ message?: string, increment?: number }>, progressScale: number, cancelToken: vscode.CancellationToken) {
    log.info(`Downloading ${url}`);
    const fileName = url.substring(url.lastIndexOf("/") + 1);
    progress.report({ message: `Downloading ${fileName}` });
    let lastDownloadedBytes = 0;
    const progressCallback = async (downloadedBytes: number, totalBytes: number | undefined) => {
        const percentage = totalBytes ? (downloadedBytes - lastDownloadedBytes) / totalBytes : 0.5;
        lastDownloadedBytes = downloadedBytes;
        const increment = percentage * progressScale;
        progress.report({ message: `Downloading ${fileName}`, increment: increment });
    };
    const file = await downloader.downloadFile(vscode.Uri.parse(url), fileName, context, cancelToken, progressCallback);
    log.info(`Downloaded ${fileName} to ${file.fsPath}`);
    return { file: file, name: fileName };
}

export async function installTools(context: vscode.ExtensionContext, progress: vscode.Progress<{ message?: string, increment?: number }>, cancelToken: vscode.CancellationToken) {
    log.info("Installing tools.");
    let dosDir = path.join(os.homedir(), ".dos");
    if (fs.existsSync(dosDir)) {
        log.info("Removing old tools.");
        fs.rmSync(dosDir, { recursive: true, force: false });
    }

    log.info(`Creating directory ${dosDir}.`);
    fs.mkdirSync(dosDir, { recursive: true })
    if (!fs.existsSync(dosDir)) {
        log.error(`Couldn't create directory ${dosDir}.`);
        return;
    }

    let gdbUrl: string;
    let djgppUrl: string;
    let dosboxUrl: string;
    switch (process.platform) {
        case "win32":
            gdbUrl = "https://github.com/badlogic/gdb-7.1a-djgpp/releases/download/gdb-7.1a-djgpp/gdb-7.1a-djgpp-windows.zip";
            djgppUrl = "https://github.com/andrewwutw/build-djgpp/releases/download/v3.3/djgpp-mingw-gcc1210-standalone.zip";
            dosboxUrl = "https://github.com/badlogic/dosbox-x/releases/download/dosbox-x-gdb-v0.84.5/dosbox-x-mingw-win64-20221223232734.zip";
            break;
        case "darwin":
            gdbUrl = "https://github.com/badlogic/gdb-7.1a-djgpp/releases/download/gdb-7.1a-djgpp/gdb-7.1a-djgpp-macos-x86_64.zip";
            djgppUrl = "https://github.com/andrewwutw/build-djgpp/releases/download/v3.3/djgpp-osx-gcc1210.tar.bz2";
            dosboxUrl = "https://github.com/badlogic/dosbox-x/releases/download/dosbox-x-gdb-v0.84.5/dosbox-x-macosx-x86_64-20221223232510.zip"
            break;
        case "linux":
            gdbUrl = "https://github.com/badlogic/gdb-7.1a-djgpp/releases/download/gdb-7.1a-djgpp/gdb-7.1a-djgpp-linux.zip";
            djgppUrl = "https://github.com/andrewwutw/build-djgpp/releases/download/v3.3/djgpp-linux64-gcc1210.tar.bz2";
            dosboxUrl = "https://github.com/badlogic/dosbox-x/releases/download/dosbox-x-gdb-v0.84.5/dosbox-x-0.84.5-linux.zip";
            break;
        default:
            log.error(`Unsupported operating system ${process.platform}`);
            return;
    }

    const downloader = await getApi();
    let gdbFile, djgppFile, dosboxFile;
    try {
        gdbFile = await downloadTool(gdbUrl, downloader, context, progress, 20, cancelToken);
        djgppFile = await downloadTool(djgppUrl, downloader, context, progress, 20, cancelToken);
        dosboxFile = await downloadTool(dosboxUrl, downloader, context, progress, 20, cancelToken);
    } catch (e) {
        console.log(e);
        log.error(`Couldn't download tools: ${(e as any).message}`);
        return;
    }

    log.info("Unzipping GDB");
    progress.report({ message: "Unzipping GDB" });
    fs.mkdirSync(path.join(dosDir, "gdb"))
    await decompress(gdbFile.file.fsPath, path.join(dosDir, "gdb"));
    progress.report({ message: "Unzipping GDB", increment: 10 });

    log.info("Unzipping DJGPP");
    progress.report({ message: "Unzipping DJGPP" });
    if (djgppFile.name.indexOf("tar.bz2") > 0) {
        await decompress(djgppFile.file.fsPath, dosDir, { "filter": file => { if (file.type !== "link") { return true; } return false; } });
    } else {
        await extractZip(djgppFile.file.fsPath, dosDir);
    }
    progress.report({ message: "Unzipping DJGPP", increment: 10 });

    log.info("Unzipping DOSBox-x");
    progress.report({ message: "Unzipping DOSBOX-x" });
    await decompress(dosboxFile.file.fsPath, path.join(dosDir));
    progress.report({ message: "Unzipping DOSBOX-x", increment: 10 });

    if (process.platform == "win32") {
        fs.rmSync(path.join(dosDir, "COPYING"));
        fsextra.moveSync(path.join(dosDir, "mingw-build", "mingw"), path.join(dosDir, "dosbox-x"));
        fs.rmSync(path.join(dosDir, "mingw-build"), { recursive: true, force: false });
    }

    if (process.platform == "darwin") {
        fs.chmodSync(path.join(dosDir, "gdb", "gdb"), 0o755);
        let files = fs.readdirSync(path.join(dosDir, "djgpp", "bin"));
        for (const file of files) {
            fs.chmodSync(path.join(dosDir, "djgpp", "bin", file), 0o755);
        }
        files = fs.readdirSync(path.join(dosDir, "djgpp", "i586-pc-msdosdjgpp", "bin"));
        for (const file of files) {
            fs.chmodSync(path.join(dosDir, "djgpp", "i586-pc-msdosdjgpp", "bin", file), 0o755);
        }
        fs.chmodSync(path.join(dosDir, "dosbox-x", "dosbox-x.app", "Contents", "MacOS", "dosbox-x"), 0o755);
        fs.symlinkSync(path.join(dosDir, "dosbox-x", "dosbox-x.app", "Contents", "MacOS", "dosbox-x"), path.join(dosDir, "dosbox-x", "dosbox-x"), "file");
    }

    if (process.platform == "linux") {
        fs.chmodSync(path.join(dosDir, "gdb", "gdb"), 0o755);
        let files = fs.readdirSync(path.join(dosDir, "djgpp", "bin"));
        for (const file of files) {
            fs.chmodSync(path.join(dosDir, "djgpp", "bin", file), 0o755);
        }
        files = fs.readdirSync(path.join(dosDir, "djgpp", "i586-pc-msdosdjgpp", "bin"));
        for (const file of files) {
            fs.chmodSync(path.join(dosDir, "djgpp", "i586-pc-msdosdjgpp", "bin", file), 0o755);
        }
        fs.renameSync(path.join(dosDir, "dosbox-x", "dosbox-x-sdl1"), path.join(dosDir, "dosbox-x", "dosbox-x"));
        fs.chmodSync(path.join(dosDir, "dosbox-x", "dosbox-x"), 0o755);
    }

    fs.copyFileSync(path.join(context.extensionPath, "tools", "toolchain-djgpp.cmake"), path.join(dosDir, "toolchain-djgpp.cmake"));
    fs.copyFileSync(path.join(context.extensionPath, "tools", "dosbox-x.conf"), path.join(dosDir, "dosbox-x.conf"));

    // FIXME check if dependencies are installed on Linux.
}