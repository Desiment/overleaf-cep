import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAsync from '@/shared/hooks/use-async'
import { debugConsole } from '@/utils/debugging'
import {
  postJSON,
  getJSON,
} from '@/infrastructure/fetch-json'
import getMeta from '@/utils/meta'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import Notification from '@/shared/components/notification'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormSelect from '@/shared/components/ol/ol-form-select'

type GitSyncRepo = {
  name: string
  fullName: string
  defaultBranchName: string
}

type GitSyncReposResponse = {
  repos?: GitSyncRepo[]
}

type GitSyncBranchesResponse = {
  branches: string[]
}

const EMPTY_REPOS: GitSyncRepo[] = []

function ImportFromGitHubModalContent({ handleHide }: { handleHide: () => void }) {
  const { t } = useTranslation()
  const { appName } = getMeta('ol-ExposedSettings')

  const {
    isLoading,
    isSuccess,
    isError,
    data,
    runAsync,
  } = useAsync<GitSyncReposResponse>()

  useEffect(() => {
    runAsync(getJSON('/user/github-sync/repos'))
      .catch(err => debugConsole.error(err?.data?.message || err?.message || err))
  }, [runAsync])

  const reposExist = data?.repos != null
  const repos = reposExist ? data.repos : EMPTY_REPOS
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('')
  const selectedRepo = repos.find(repo => repo.fullName === selectedRepoFullName)

  const {
    isLoading: isLoadingBranches,
    isError: isErrorBranches,
    data: branchData,
    runAsync: runAsyncBranches,
    reset: resetBranches,
  } = useAsync<GitSyncBranchesResponse>()
  const [selectedBranch, setSelectedBranch] = useState('')

  useEffect(() => {
    setSelectedBranch('')
    resetBranches()
    if (!selectedRepo) return

    const params = new URLSearchParams({ repo: selectedRepo.fullName })
    runAsyncBranches(getJSON(`/user/github-sync/branches?${params}`))
      .then(({ branches }) => {
        const defaultBranch = selectedRepo.defaultBranchName
        setSelectedBranch(
          branches.includes(defaultBranch) ? defaultBranch : branches[0] || ''
        )
      })
      .catch(err => debugConsole.error(err?.data?.message || err?.message || err))
  }, [resetBranches, runAsyncBranches, selectedRepo, selectedRepoFullName])

  const {
    isLoading: isImporting,
    isSuccess: isImported,
    isError: isErrorImport,
    runAsync: runAsyncImport,
  } = useAsync<{ projectId: string }>()

  useEffect(() => {
    if (isImported) {
      handleHide()
    }
  }, [handleHide, isImported])

  const showLinkToGitHub = !isImporting && isSuccess && !reposExist
  const showRepos = !isImporting && isSuccess && reposExist

  const handleImport = () => {
    if (!selectedRepo || !selectedBranch) return

    runAsyncImport(
      postJSON('/project/new/github-sync', {
        body: {
          ...selectedRepo,
          defaultBranchName: selectedBranch,
        },
      })
    )
      .then(data => {
        window.location.href = `/project/${data.projectId}`
      })
      .catch(err => debugConsole.error(err?.data?.message || err?.message || err))
  }

  return (
    <>
      <OLModalHeader onClose={handleHide}>
        <OLModalTitle>{t('import_from_github')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {isLoading && (
          <span>
            <OLSpinner size="sm" className="me-2"/>
            {t('loading_github_repositories')}
          </span>
        )}

        {isImporting && (
          <span>
            <OLSpinner size="sm" className="me-2"/>
            {t('importing')}
          </span>
        )}

        {isError && (
          <div className="notification-list">
            <Notification
              type="error"
              content={t('something_went_wrong_server')}
            />
          </div>
        )}

        {showLinkToGitHub && (
          <div className="text-center">
            <p>
              {t('link_to_github_description', { appName })}
            </p>
            <OLButton
              variant="secondary"
              href="/user/github-sync/oauth2"
            >
              {t('link_to_github')}
            </OLButton>
          </div>
        )}

        {showRepos && (
          <div>
            {repos.length === 0 ? (
              <p className="text-center">
                {t('you_dont_have_any_repositories')}
              </p>
            ) : (
              <>
                <p className="text-center">
                  {t('select_github_repository', { appName })}
                </p>
                <OLFormGroup>
                  <OLFormLabel htmlFor="github-sync-repository">
                    {t('github_repository')}
                  </OLFormLabel>
                  <OLFormSelect
                    id="github-sync-repository"
                    value={selectedRepoFullName}
                    onChange={event => setSelectedRepoFullName(event.target.value)}
                  >
                    <option value="">{t('select_a_github_repository')}</option>
                    {repos.map(repo => (
                      <option key={repo.fullName} value={repo.fullName}>
                        {repo.name} ({repo.fullName})
                      </option>
                    ))}
                  </OLFormSelect>
                </OLFormGroup>

                {selectedRepo && (
                  <>
                    <OLFormGroup>
                      <OLFormLabel htmlFor="github-sync-branch">
                        {t('github_branch')}
                      </OLFormLabel>
                      {isLoadingBranches ? (
                        <span>
                          <OLSpinner size="sm" className="me-2" />
                          {t('loading_github_branches')}
                        </span>
                      ) : (
                        <OLFormSelect
                          id="github-sync-branch"
                          value={selectedBranch}
                          disabled={isErrorBranches || !branchData?.branches.length}
                          onChange={event => setSelectedBranch(event.target.value)}
                        >
                          <option value="">{t('select_a_github_branch')}</option>
                          {branchData?.branches.map(branch => (
                            <option key={branch} value={branch}>
                              {branch}
                            </option>
                          ))}
                        </OLFormSelect>
                      )}
                    </OLFormGroup>

                    {isErrorBranches && (
                      <Notification
                        type="error"
                        content={t('something_went_wrong_server')}
                      />
                    )}

                    <div className="text-end">
                      <OLButton
                        variant="primary"
                        disabled={isLoadingBranches || !selectedBranch}
                        onClick={handleImport}
                      >
                        {t('import_to_sharelatex', { appName: 'Overleaf' })}
                      </OLButton>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {isErrorImport && (
          <div className="notification-list">
            <Notification
              type="error"
              content={t('something_went_wrong_server')}
            />
          </div>
        )}

      </OLModalBody>

      <OLModalFooter>
        {!isImporting && (
        <span className="me-auto">
          <a
            href="https://help.github.com/en/articles/requesting-organization-approval-for-oauth-apps"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('cant_see_what_youre_looking_for_question')}
          </a>
        </span>
        )}
        <OLButton
          variant="secondary"
          onClick={handleHide}
          disabled={isImporting}
        >
          {t('cancel')}
        </OLButton>
      </OLModalFooter>
    </>
  )
}

export default function ImportFromGitHubModal({ onHide }: { onHide: () => void }) {
  return (
    <OLModal
      id="git-import-modal"
      show
      animation
      size="lg"
      onHide={onHide}
      backdrop="static"
      themed="true"
    >
      <ImportFromGitHubModalContent handleHide={onHide} />
    </OLModal>
  )
}
