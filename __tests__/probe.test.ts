import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as artifact from "@actions/artifact";
import * as actionsExec from "@actions/exec";
import {
  extractBinary,
  extractPathFromOutput,
  findNewestDumpFile,
  runAnalyze,
  uploadDump,
} from "../src/probe";

jest.mock("@actions/exec", () => {
  const actual = jest.requireActual("@actions/exec");
  return { ...actual, getExecOutput: jest.fn() };
});
jest.mock("@actions/artifact", () => ({
  __esModule: true,
  DefaultArtifactClient: jest.fn().mockImplementation(() => ({
    uploadArtifact: jest.fn(),
  })),
}));

// extractBinary only unzips + chmods — no sudo, never touches the real binary's
// behavior — so it's safe to exercise directly against the real bin/system-probe.zip.
describe("extractBinary", () => {
  const actionDir = path.join(__dirname, "..");
  let runnerTemp: string;
  let previousRunnerTemp: string | undefined;

  beforeEach(() => {
    runnerTemp = fs.mkdtempSync(
      path.join(os.tmpdir(), "anomalous-runner-temp-"),
    );
    previousRunnerTemp = process.env.RUNNER_TEMP;
    process.env.RUNNER_TEMP = runnerTemp;
  });

  afterEach(() => {
    if (previousRunnerTemp === undefined) {
      delete process.env.RUNNER_TEMP;
    } else {
      process.env.RUNNER_TEMP = previousRunnerTemp;
    }
    fs.rmSync(runnerTemp, { recursive: true, force: true });
  });

  it("unzips bin/system-probe.zip into an executable binary under the action dir", async () => {
    const binaryPath = await extractBinary(actionDir);

    expect(fs.existsSync(binaryPath)).toBe(true);
    expect(fs.statSync(binaryPath).mode & 0o111).not.toBe(0);
  }, 30_000);
});

describe("extractPathFromOutput", () => {
  it("extracts a known dump extension from CLI output", () => {
    const out =
      "activity dump stopped, wrote /tmp/anomalous-probe/profiles/dump-1.json\n";
    expect(extractPathFromOutput(out)).toBe(
      "/tmp/anomalous-probe/profiles/dump-1.json",
    );
  });

  it("returns null when no path is present", () => {
    expect(extractPathFromOutput("activity dump stopped")).toBeNull();
  });

  it("returns null for an unrecognized extension", () => {
    expect(extractPathFromOutput("wrote /tmp/foo/dump.txt")).toBeNull();
  });
});

describe("findNewestDumpFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "anomalous-probe-test-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty string when the profiles dir doesn't exist", () => {
    expect(findNewestDumpFile(dir)).toBe("");
  });

  it("returns empty string when the profiles dir is empty", () => {
    fs.mkdirSync(path.join(dir, "profiles"));
    expect(findNewestDumpFile(dir)).toBe("");
  });

  it("picks the most recently modified file", () => {
    const profilesDir = path.join(dir, "profiles");
    fs.mkdirSync(profilesDir);

    const older = path.join(profilesDir, "dump-old.json");
    const newer = path.join(profilesDir, "dump-new.json");
    fs.writeFileSync(older, "{}");
    fs.writeFileSync(newer, "{}");

    const now = Date.now();
    fs.utimesSync(older, new Date(now - 60_000), new Date(now - 60_000));
    fs.utimesSync(newer, new Date(now), new Date(now));

    expect(findNewestDumpFile(dir)).toBe(newer);
  });
});

describe("uploadDump", () => {
  const { DefaultArtifactClient } = artifact as unknown as {
    DefaultArtifactClient: jest.Mock;
  };
  let tmpDir: string;
  let dumpFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "anomalous-upload-"));
    dumpFile = path.join(tmpDir, "profiles", "dump-1.json");
    fs.mkdirSync(path.dirname(dumpFile), { recursive: true });
    fs.writeFileSync(dumpFile, "{}");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when the dump file does not exist", async () => {
    const result = await uploadDump("/no/such/file.json", "dump");
    expect(result).toBeNull();
  });

  it("uploads the dump under the given artifact name and root directory", async () => {
    const uploadArtifact = jest.fn().mockResolvedValue({ id: 42, size: 1024 });
    DefaultArtifactClient.mockImplementation(() => ({ uploadArtifact }));

    const result = await uploadDump(dumpFile, "anomalous-dump");

    expect(uploadArtifact).toHaveBeenCalledTimes(1);
    expect(uploadArtifact).toHaveBeenCalledWith(
      "anomalous-dump",
      [dumpFile],
      path.dirname(dumpFile),
    );
    expect(result).toEqual({ id: 42, size: 1024 });
  });
});

describe("runAnalyze", () => {
  const getExecOutput = actionsExec.getExecOutput as unknown as jest.Mock;

  beforeEach(() => {
    getExecOutput.mockReset();
  });

  it("installs the package then runs `anomalous analyze` with the right args", async () => {
    getExecOutput.mockImplementation((cmd: string, _args: string[]) =>
      Promise.resolve({
        exitCode: 0,
        stdout: cmd === "anomalous" ? "[]" : "installed",
        stderr: "",
      }),
    );

    const result = await runAnalyze(
      "/tmp/dump.json",
      "/tmp/model.joblib",
      "/action",
    );

    expect(getExecOutput).toHaveBeenCalledTimes(2);
    // First call: pip install the package from the action dir.
    expect(getExecOutput).toHaveBeenNthCalledWith(
      1,
      "python3",
      ["-m", "pip", "install", "--quiet", "/action"],
      expect.objectContaining({ silent: true }),
    );
    // Second call: anomalous analyze <dump> --model <model>.
    expect(getExecOutput).toHaveBeenNthCalledWith(
      2,
      "anomalous",
      ["analyze", "/tmp/dump.json", "--model", "/tmp/model.joblib"],
      expect.objectContaining({
        ignoreReturnCode: true,
        silent: true,
      }),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("[]");
  });

  it("propagates a findings exit code (1) instead of throwing", async () => {
    getExecOutput.mockImplementation((cmd: string) =>
      Promise.resolve({
        exitCode: cmd === "anomalous" ? 1 : 0,
        stdout: cmd === "anomalous" ? '[{"category":"network"}]' : "",
        stderr: "",
      }),
    );

    const result = await runAnalyze(
      "/tmp/dump.json",
      "/tmp/model.joblib",
      "/action",
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("network");
  });
});
