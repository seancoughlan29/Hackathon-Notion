import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import type { Config, Project } from "../types";
import { upload, message } from "../api";
import { Modal } from "./Modal";

export function UploadDialog({
  project,
  config,
  close,
  save,
}: {
  project: Project;
  config: Config;
  close: () => void;
  save: (project: Project) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  return (
    <Modal title="From handbook to head start" close={close} busy={busy}>
      <p className="muted">
        Upload module PDFs, Word docs, PowerPoints, spreadsheets, or a ZIP
        straight from Moodle. We'll pull out assessments, deadlines and weights
        for you to review.
      </p>
      {!config.openai_configured && (
        <div className="notice">
          To extract real documents, set OPENAI_API_KEY in the backend .env file
          and restart. You can use the demo or enter assessments manually now.
        </div>
      )}
      <label className="upload-drop">
        <Upload size={30} />
        <strong>Choose module handbooks</strong>
        <span>
          PDF, Word, PowerPoint, Excel, HTML, text or a ZIP of them · up to 5
          files · 25 MB each
        </span>
        <input
          aria-label="Choose module handbooks"
          type="file"
          multiple
          accept=".pdf,.docx,.docm,.dotx,.pptx,.pptm,.xlsx,.xlsm,.odt,.odp,.ods,.html,.htm,.rtf,.txt,.md,.csv,.tsv,.zip"
          disabled={busy || finished}
          onChange={(e) => {
            setFiles(Array.from(e.target.files ?? []));
            setError("");
          }}
        />
      </label>
      {files.map((file, i) => (
        <div className="file-row" key={`${file.name}-${i}`}>
          <FileText size={17} />
          <span>{file.name}</span>
          <small>{(file.size / 1024).toFixed(0)} KB</small>
        </div>
      ))}
      <label className="check-row">
        <input
          type="checkbox"
          checked={consent}
          disabled={busy}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I agree to send these documents' text to OpenAI for extraction.
      </label>
      <p className="small muted">
        The backend does not retain raw uploads after processing. Extracted
        entries and source excerpts stay in this browser tab. AI can miss or
        misread details; review against the original.
      </p>
      {status && (
        <p className="notice" role="status">
          {busy && <span className="spinner" />} {status}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!!warnings.length && (
        <details open>
          <summary>Extraction notes ({warnings.length})</summary>
          <ul className="small">
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="modal-actions">
        {finished ? (
          <button className="button primary" onClick={close}>
            Review assessments
          </button>
        ) : (
          <button
            className="button primary"
            disabled={
              busy || !consent || !files.length || !config.openai_configured
            }
            onClick={async () => {
              if (
                files.length > 5 ||
                files.some((file) => file.size > 25 * 1024 * 1024)
              ) {
                setError("Choose at most 5 files, each no larger than 25 MB.");
                return;
              }
              setBusy(true);
              setError("");
              setWarnings([]);
              let current = project;
              let count = 0;
              try {
                for (const [i, file] of files.entries()) {
                  setStatus(
                    `Reading ${file.name} (${i + 1}/${files.length}). Large documents can take several minutes…`,
                  );
                  const data = new FormData();
                  data.append("file", file);
                  data.append("project", JSON.stringify(current));
                  data.append("consent", "true");
                  const result = await upload<{
                    project: Project;
                    warnings: string[];
                    extracted: number;
                  }>(data);
                  current = result.project;
                  count += result.extracted;
                  save(current);
                  setWarnings((old) => [...old, ...result.warnings]);
                }
                setStatus(
                  `Extraction finished: ${count} assessments found. Check the source for anything missing.`,
                );
                setFinished(true);
              } catch (err) {
                setError(
                  `${message(err)} Earlier successful files, if any, are already saved. Re-uploading the same files preserves existing entries.`,
                );
                setStatus("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Extracting…" : "Extract assessments"}
          </button>
        )}
      </div>
    </Modal>
  );
}
