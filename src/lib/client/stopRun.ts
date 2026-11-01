/**
 * Stopping a plan run from the processing screen. Leaving the screen aborts the job (usePlanJob), and
 * the plan route passes that abort to the pipeline, which stops before its next step. A preview run
 * costs nothing, so it stops on the first tap; a real run asks once, since the step in progress may
 * still finish and bill.
 */

/** Button label on the processing screen. */
export const STOP_RUN_LABEL = "Stop this run";

/** Confirm question shown before a real run stops, or null when the run can stop on the first tap. */
export function stopRunConfirm(realRun: boolean): string | null {
  return realRun
    ? "Stop this run? The step in progress may still finish, but nothing after it runs. Your video stays here so you can start again."
    : null;
}

/** Note on the upload screen after a run was stopped, with the kept video's name. */
export function stoppedRunNote(videoName: string): string {
  const name = videoName.trim();
  return name ? `Run stopped. ${name} is still here, so you can change the details and start again.` : "Run stopped. Your video is still here, so you can change the details and start again.";
}
