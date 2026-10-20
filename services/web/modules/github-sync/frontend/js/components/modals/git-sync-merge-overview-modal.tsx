import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAsync from '@/shared/hooks/use-async'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import { OLModalBody, OLModalFooter } from '@/shared/components/ol/ol-modal'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormSelect from '@/shared/components/ol/ol-form-select'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLButton from '@/shared/components/ol/ol-button'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import Notification from '@/shared/components/notification'
import { debugConsole } from '@/utils/debugging'
import { ProjectSyncState, GitSyncModalStatus } from '../../types/git-sync-types'

type GitSyncMergeOverviewModalProps = {
  handleHide: () => void
  setModalStatus: (modalStatus: GitSyncModalStatus) => void
  projectSyncState: ProjectSyncState
  projectId: string
  commitMessage: string
  setCommitMessage: (message: string) => void

}

type GitCommit = {
  message: string
  author: {
    name: string
    email: string
    date: string
  }
  sha: string
}

type UnmergedCommitsResponse = {
  commits: GitCommit[]
  diverged: boolean
  isProjectUpdated: boolean
}

type BranchesResponse = {
  branches: string[]
}

const GitSyncMergeOverviewModal = ({
  handleHide,
  setModalStatus,
  projectSyncState,
  projectId,
  commitMessage,
  setCommitMessage
}: GitSyncMergeOverviewModalProps) => {
  const { t } = useTranslation()
  const appName = 'Overleaf'

  const {
    data,
    setData,
    error,
    isSuccess,
    isLoading,
    runAsync,
  } = useAsync<UnmergedCommitsResponse | null>()

  const [selectedBranch, setSelectedBranch] = useState('')
  const {
    data: branchesData,
    error: branchesError,
    isLoading: isLoadingBranches,
    runAsync: runAsyncBranches,
  } = useAsync<BranchesResponse>()
  const {
    error: changeBranchError,
    isLoading: isChangingBranch,
    runAsync: runAsyncChangeBranch,
  } = useAsync()

  const canChangeBranch = Boolean(
    projectSyncState.isOwner &&
    isSuccess &&
    data &&
    !data.isProjectUpdated &&
    !data.diverged &&
    data.commits?.length === 0,
  )

  const loadUnmergedCommits = () => {
    setData({})

    runAsync(getJSON(`/project/${projectId}/github-sync/merge/overview`))
      .then(data => { if (!data) setModalStatus('loading') })
      .catch(err => {
        debugConsole.error(err?.data?.message || err?.message || err)
        if (err?.info?.statusCode === 403 ||
            err?.info?.statusCode === 404 ||
            err?.info?.statusCode === 401
        ) setModalStatus('loading')
      })
  }

  useEffect(() => {
    loadUnmergedCommits()
  }, [projectId, runAsync])

  useEffect(() => {
    if (!canChangeBranch) return

    const params = new URLSearchParams({ repo: projectSyncState.repoFullName })
    runAsyncBranches(getJSON(`/user/github-sync/branches?${params}`))
      .then(({ branches }) => {
        const currentBranch = projectSyncState.defaultBranchName
        setSelectedBranch(
          branches.includes(currentBranch) ? currentBranch : branches[0] || ''
        )
      })
      .catch(err => debugConsole.error(err?.data?.message || err?.message || err))
  }, [
    canChangeBranch,
    projectSyncState.defaultBranchName,
    projectSyncState.repoFullName,
    runAsyncBranches,
  ])

  const changeBranch = () => {
    if (!selectedBranch || selectedBranch === projectSyncState.defaultBranchName) return

    runAsyncChangeBranch(
      postJSON(`/project/${projectId}/github-sync/branch`, {
        body: { branchName: selectedBranch },
      })
    )
      .then(() => setModalStatus('loading'))
      .catch(err => debugConsole.error(err?.data?.message || err?.message || err))
  }

  return (
    <>
      <OLModalBody>
        <p>
          {t('project_linked_to')}:&nbsp;
          <a
            href={`https://github.com/${projectSyncState.repoFullName}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            {projectSyncState.repoFullName}
          </a>
        </p>

        {isLoading && (
          <>
            <div role="status" className="loading align-items-start">
              <div
                aria-hidden="true"
                data-testid="ol-spinner"
                className="spinner-border spinner-border-sm"
              ></div>
              {t('loading')}
            </div>
          </>
        )}

        {isSuccess && (
          <>
            <hr />

            {data.diverged && (
              <Notification
                type="warning"
                content={t('github_repository_diverged')}
              />
            )}

            <h3 className="github-sync-commits-heading">
              {t('recent_commits_in_github')}

              <OLIconButton
                icon="refresh"
                size="sm"
                variant="ghost"
                onClick={loadUnmergedCommits}
                accessibilityLabel={t('refresh')}
              />
            </h3>

            {data.commits?.length === 0 && (
              <div>
                <p className="small">{t('no_new_commits_in_github')}</p>
              </div>
            )}

            {data.commits?.length > 0 && (
              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                {data.commits.map((commit: GitCommit) => (
                  <div key={commit.sha}>
                    <span className="small float-end">
                      <a
                        href={`https://github.com/${projectSyncState.repoFullName}/commit/${commit.sha}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {commit.sha.substring(0, 7)}
                      </a>
                    </span>

                    <a
                      href={`https://github.com/${projectSyncState.repoFullName}/commit/${commit.sha}`}
                      target="_blank"
                      className="commit-message"
                      rel="noreferrer noopener"
                    >
                      {commit.message}
                    </a>

                    <div className="small">
                      by {commit.author.name} &lt;{commit.author.email}&gt;
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canChangeBranch && (
              <>
                <hr />
                <p>{t('change_github_branch_description')}</p>
                <OLRow>
                  <OLCol xs={8}>
                    <OLFormGroup>
                      <OLFormLabel htmlFor="github-sync-current-branch">
                        {t('github_branch')}
                      </OLFormLabel>
                      {isLoadingBranches ? (
                        <span>
                          <OLSpinner size="sm" className="me-2" />
                          {t('loading_github_branches')}
                        </span>
                      ) : (
                        <OLFormSelect
                          id="github-sync-current-branch"
                          value={selectedBranch}
                          disabled={Boolean(branchesError) || isChangingBranch}
                          onChange={event => setSelectedBranch(event.target.value)}
                        >
                          <option value="">{t('select_a_github_branch')}</option>
                          {branchesData?.branches.map(branch => (
                            <option key={branch} value={branch}>
                              {branch}
                            </option>
                          ))}
                        </OLFormSelect>
                      )}
                    </OLFormGroup>
                  </OLCol>
                  <OLCol xs={4} className="d-flex align-items-end">
                    <OLButton
                      variant="secondary"
                      className="mb-3"
                      disabled={
                        isLoadingBranches ||
                        isChangingBranch ||
                        !selectedBranch ||
                        selectedBranch === projectSyncState.defaultBranchName
                      }
                      onClick={changeBranch}
                    >
                      {t('change_github_branch')}
                    </OLButton>
                  </OLCol>
                </OLRow>

                {(branchesError || changeBranchError) && (
                  <Notification
                    type="error"
                    content={t('generic_something_went_wrong')}
                  />
                )}
              </>
            )}

            {data.isProjectUpdated && (
              <>
                <hr />
                <OLForm>
                  <p>{t('sync_project_to_github_explanation', { appName })}</p>
                  <OLRow>
                    <OLCol xs={12}>
                      <OLFormGroup>
                        <OLFormControl
                          as="textarea"
                          rows={1}
                          value={commitMessage}
                          placeholder={t('github_commit_message_placeholder', { appName })}
                          onChange={(e) => setCommitMessage(e.target.value)}
                        />
                      </OLFormGroup>
                    </OLCol>
                  </OLRow>
                </OLForm>
              </>
            )}
          </>
        )}

        {error && (
          <Notification
            type="error"
            content={t('generic_something_went_wrong')}
          />
        )}

      </OLModalBody>

      <OLModalFooter>
        <div className="d-flex justify-content-between w-100">

          <div className="d-flex gap-2">
            <OLButton
              variant="danger-ghost"
              onClick={() => setModalStatus('confirm-unlink')}
              disabled={!isSuccess && error?.info?.statusCode !== 404}
            >
              {t('unlink')}
            </OLButton>
          </div>

          <div className="d-flex gap-2">
            <OLButton
              variant="primary"
              leadingIcon="sync"
              onClick={() => setModalStatus('run-merge')}
              disabled={!isSuccess}
            >
              {t('sync')}
            </OLButton>

            <OLButton
              variant="secondary"
              onClick={handleHide}
            >
              {t('close')}
            </OLButton>
          </div>

        </div>
      </OLModalFooter>
    </>
  )
}

export default GitSyncMergeOverviewModal
