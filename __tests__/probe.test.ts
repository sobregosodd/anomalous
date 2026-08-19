import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  extractBinary,
  extractPathFromOutput,
  findNewestDumpFile,
} from "../src/probe";

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
