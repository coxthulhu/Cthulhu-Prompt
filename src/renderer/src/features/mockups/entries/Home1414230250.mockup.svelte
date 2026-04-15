<script lang="ts">
  import {
    AlertCircle,
    ArrowRight,
    Check,
    FileText,
    FolderOpen,
    FolderPlus,
    FolderTree,
    HardDrive,
    Sparkles,
    X
  } from 'lucide-svelte'

  type DialogState = 'setup' | 'existing' | 'invalid-root' | null

  let workspacePath = $state('C:\\Users\\Dmin\\Documents\\Cthulhu Prompt Workspace')
  let workspaceReady = $state(true)
  let includeExamplePrompts = $state(true)
  let dialogState = $state<DialogState>(null)

  const promptCount = 128
  const folderCount = 14

  const handleSelectWorkspace = () => {
    if (workspaceReady) {
      return
    }
    dialogState = 'existing'
  }

  const handleCreateWorkspace = () => {
    dialogState = 'setup'
  }

  const handleSetupWorkspace = () => {
    workspaceReady = true
    dialogState = null
  }

  const handleSelectExistingWorkspace = () => {
    workspaceReady = true
    dialogState = null
  }

  const handleCloseWorkspace = () => {
    workspaceReady = false
    dialogState = null
  }

  const closeDialog = () => {
    dialogState = null
  }

  const openRootPathDialog = () => {
    dialogState = 'invalid-root'
  }

  const openSetupDialog = () => {
    dialogState = 'setup'
  }

  const openExistingDialog = () => {
    dialogState = 'existing'
  }
</script>

{#snippet statCard(Icon, value, label)}
  <div
    style="display: flex; min-width: 0; flex: 1 1 0; align-items: center; gap: 14px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.08); background: linear-gradient(180deg, rgba(20, 24, 34, 0.96), rgba(10, 13, 20, 0.96)); padding: 18px 20px; box-shadow: 0 20px 44px rgba(0, 0, 0, 0.34);"
  >
    <div
      style="display: flex; height: 48px; width: 48px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 18px; background: rgba(124, 92, 255, 0.12); color: #c9b8ff; box-shadow: inset 0 0 0 1px rgba(160, 129, 255, 0.18);"
    >
      <Icon size={20} />
    </div>
    <div style="min-width: 0;">
      <div style="font-size: 1.55rem; font-weight: 700; line-height: 1; color: #f5f7fb;">
        {value}
      </div>
      <div style="margin-top: 6px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.03em; color: #98a1b3; text-transform: uppercase;">
        {label}
      </div>
    </div>
  </div>
{/snippet}

{#snippet actionButton(Icon, text, onclick, variant)}
  <button
    type="button"
    onclick={onclick}
    style={`display: inline-flex; min-height: 58px; flex: 1 1 0; align-items: center; justify-content: center; gap: 12px; border-radius: 22px; border: 1px solid ${
      variant === 'primary'
        ? 'rgba(154, 125, 255, 0.4)'
        : variant === 'danger'
          ? 'rgba(251, 113, 133, 0.26)'
          : 'rgba(255, 255, 255, 0.09)'
    }; background: ${
      variant === 'primary'
        ? 'linear-gradient(180deg, rgba(97, 74, 184, 0.95), rgba(66, 51, 128, 0.95))'
        : variant === 'danger'
          ? 'rgba(120, 24, 52, 0.22)'
          : 'rgba(255, 255, 255, 0.04)'
    }; padding: 0 22px; color: ${
      variant === 'danger' ? '#ffd7de' : '#f5f7fb'
    }; font-size: 0.97rem; font-weight: 700; letter-spacing: 0.01em; box-shadow: ${
      variant === 'primary'
        ? '0 20px 40px rgba(48, 31, 100, 0.32)'
        : '0 16px 30px rgba(0, 0, 0, 0.22)'
    }; cursor: pointer; transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;`}
  >
    <span style="display: inline-flex; align-items: center; justify-content: center; color: inherit;">
      <Icon size={18} />
    </span>
    <span>{text}</span>
  </button>
{/snippet}

{#snippet smallUtilityButton(text, onclick)}
  <button
    type="button"
    onclick={onclick}
    style="display: inline-flex; min-height: 42px; align-items: center; justify-content: center; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.03); padding: 0 16px; color: #c7cfdd; font-size: 0.84rem; font-weight: 700; letter-spacing: 0.01em; cursor: pointer;"
  >
    {text}
  </button>
{/snippet}

{#snippet dialogButton(text, onclick, variant)}
  <button
    type="button"
    onclick={onclick}
    style={`display: inline-flex; min-height: 46px; min-width: ${
      variant === 'primary' ? '166px' : '120px'
    }; align-items: center; justify-content: center; border-radius: 16px; border: 1px solid ${
      variant === 'primary' ? 'rgba(154, 125, 255, 0.45)' : 'rgba(255, 255, 255, 0.08)'
    }; background: ${
      variant === 'primary'
        ? 'linear-gradient(180deg, rgba(101, 76, 191, 0.96), rgba(73, 56, 141, 0.96))'
        : 'rgba(255, 255, 255, 0.03)'
    }; padding: 0 18px; color: #f5f7fb; font-size: 0.92rem; font-weight: 700; cursor: pointer;`}
  >
    {text}
  </button>
{/snippet}

<main
  data-testid="home-screen-mockup"
  style="min-height: 100%; background:
    radial-gradient(circle at top, rgba(109, 84, 206, 0.2), transparent 34%),
    linear-gradient(180deg, #05070c 0%, #07090f 48%, #05070b 100%);
    color: #f5f7fb;"
>
  <div
    style="display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 40px 24px;"
  >
    <div style="width: min(1120px, 100%);">
      <div
        style="position: relative; overflow: hidden; border-radius: 34px; border: 1px solid rgba(255, 255, 255, 0.08); background: linear-gradient(180deg, rgba(14, 17, 26, 0.98), rgba(8, 10, 16, 0.98)); padding: 34px; box-shadow: 0 36px 80px rgba(0, 0, 0, 0.42);"
      >
        <div
          style="position: absolute; inset: -120px auto auto -120px; height: 280px; width: 280px; border-radius: 999px; background: radial-gradient(circle, rgba(124, 92, 255, 0.18), transparent 68%); pointer-events: none;"
        ></div>

        <div
          style="position: relative; display: grid; gap: 24px; grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.85fr);"
        >
          <section
            style="display: flex; min-width: 0; flex-direction: column; gap: 24px; border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.07); background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.02)); padding: 30px;"
          >
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px;">
              <div style="min-width: 0;">
                <div
                  style="display: inline-flex; align-items: center; gap: 10px; border-radius: 999px; border: 1px solid rgba(160, 129, 255, 0.18); background: rgba(120, 92, 255, 0.08); padding: 8px 14px; color: #d6c8ff; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;"
                >
                  <Sparkles size={14} />
                  <span>CTHULHU PROMPT</span>
                </div>
                <h1
                  data-testid="home-title"
                  style="margin: 18px 0 0; font-size: clamp(2.45rem, 4.5vw, 4.3rem); font-weight: 800; letter-spacing: 0.08em; line-height: 0.94;"
                >
                  HOME
                </h1>
                <p
                  style="margin: 16px 0 0; max-width: 34rem; color: #9ca4b5; font-size: 0.98rem; line-height: 1.7; font-weight: 600;"
                >
                  {workspaceReady
                    ? 'Select a workspace folder, jump back into your prompt library, and keep your writing environment ready.'
                    : 'Select a folder to set up your workspace and start managing prompts.'}
                </p>
              </div>

              <div
                style={`display: inline-flex; min-height: 46px; align-items: center; gap: 10px; border-radius: 18px; border: 1px solid ${
                  workspaceReady ? 'rgba(86, 198, 122, 0.24)' : 'rgba(255, 255, 255, 0.08)'
                }; background: ${
                  workspaceReady ? 'rgba(34, 84, 50, 0.28)' : 'rgba(255, 255, 255, 0.035)'
                }; padding: 0 16px; color: ${
                  workspaceReady ? '#dfffe8' : '#cfd6e3'
                }; font-size: 0.88rem; font-weight: 700; letter-spacing: 0.01em;`}
              >
                {#if workspaceReady}
                  <Check size={16} />
                  <span data-testid="workspace-ready-title">Workspace Ready</span>
                {:else}
                  <HardDrive size={16} />
                  <span>Get Started</span>
                {/if}
              </div>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 16px;">
              {@render statCard(FileText, promptCount.toString(), 'Prompts')}
              {@render statCard(FolderTree, folderCount.toString(), 'Prompt Folders')}
            </div>

            <div
              style="display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr);"
            >
              <div
                style="border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); background: linear-gradient(180deg, rgba(11, 14, 20, 0.96), rgba(7, 10, 16, 0.96)); padding: 24px;"
              >
                <div
                  style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px;"
                >
                  <div style="min-width: 0; flex: 1 1 320px;">
                    <div
                      style="color: #f5f7fb; font-size: 1.1rem; font-weight: 700; letter-spacing: 0.01em;"
                    >
                      Workspace
                    </div>
                    <div
                      style="margin-top: 8px; color: #98a1b3; font-size: 0.93rem; line-height: 1.65; font-weight: 600;"
                    >
                      {#if workspaceReady}
                        <span style="display: inline-flex; align-items: center; gap: 8px;">
                          <HardDrive size={15} />
                          <span>Current workspace</span>
                        </span>
                      {:else}
                        <span>Choose a folder or create a new workspace to continue.</span>
                      {/if}
                    </div>
                    {#if workspaceReady}
                      <div
                        data-testid="workspace-ready-path"
                        title={workspacePath}
                        style="margin-top: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.07); background: rgba(255, 255, 255, 0.035); padding: 15px 16px; color: #e5e9f2; font-size: 0.94rem; font-weight: 600;"
                      >
                        {workspacePath}
                      </div>
                    {:else}
                      <div
                        style="margin-top: 18px; border-radius: 18px; border: 1px dashed rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.02); padding: 18px 16px; color: #818a9b; font-size: 0.91rem; font-weight: 600;"
                      >
                        No workspace selected
                      </div>
                    {/if}
                  </div>

                  <div
                    style="display: flex; min-width: 220px; flex: 0 0 240px; flex-direction: column; gap: 10px;"
                  >
                    {@render actionButton(
                      FolderOpen,
                      'Select Workspace Folder',
                      handleSelectWorkspace,
                      'secondary'
                    )}
                    {@render actionButton(
                      FolderPlus,
                      'Create Workspace Folder',
                      handleCreateWorkspace,
                      'primary'
                    )}
                    {#if workspaceReady}
                      {@render actionButton(
                        X,
                        'Close Workspace',
                        handleCloseWorkspace,
                        'danger'
                      )}
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside
            style="display: flex; min-width: 0; flex-direction: column; gap: 18px;"
          >
            <div
              style="border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); background: linear-gradient(180deg, rgba(11, 14, 20, 0.98), rgba(8, 10, 16, 0.98)); padding: 24px;"
            >
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                <div>
                  <div
                    style="font-size: 0.82rem; font-weight: 800; letter-spacing: 0.08em; color: #8b93a5; text-transform: uppercase;"
                  >
                    Workspace Actions
                  </div>
                  <div
                    style="margin-top: 10px; color: #f5f7fb; font-size: 1.05rem; font-weight: 700;"
                  >
                    Quick Flows
                  </div>
                </div>
                <div
                  style="display: flex; height: 42px; width: 42px; align-items: center; justify-content: center; border-radius: 16px; background: rgba(124, 92, 255, 0.1); color: #d4c6ff;"
                >
                  <ArrowRight size={18} />
                </div>
              </div>

              <div style="margin-top: 20px; display: grid; gap: 12px;">
                {@render smallUtilityButton('Setup Workspace', openSetupDialog)}
                {@render smallUtilityButton('Workspace Already Exists', openExistingDialog)}
                {@render smallUtilityButton('Invalid Workspace Folder', openRootPathDialog)}
              </div>
            </div>

            <div
              style="border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); background: linear-gradient(180deg, rgba(15, 18, 27, 0.98), rgba(9, 11, 17, 0.98)); padding: 24px;"
            >
              <div
                style="font-size: 0.82rem; font-weight: 800; letter-spacing: 0.08em; color: #8b93a5; text-transform: uppercase;"
              >
                Status
              </div>
              <div
                style="margin-top: 16px; display: flex; flex-direction: column; gap: 14px;"
              >
                <div
                  style="display: flex; align-items: center; justify-content: space-between; gap: 16px; border-radius: 20px; background: rgba(255, 255, 255, 0.03); padding: 16px;"
                >
                  <div>
                    <div style="color: #f5f7fb; font-size: 0.94rem; font-weight: 700;">
                      Workspace State
                    </div>
                    <div
                      style="margin-top: 4px; color: #8e97a8; font-size: 0.84rem; font-weight: 600;"
                    >
                      {workspaceReady ? 'Connected' : 'Not connected'}
                    </div>
                  </div>
                  <div
                    style={`display: inline-flex; height: 12px; width: 12px; border-radius: 999px; background: ${
                      workspaceReady ? '#46c46f' : '#6f7788'
                    }; box-shadow: 0 0 0 6px ${
                      workspaceReady ? 'rgba(70, 196, 111, 0.12)' : 'rgba(111, 119, 136, 0.14)'
                    };`}
                  ></div>
                </div>

                <div
                  style="display: flex; align-items: center; justify-content: space-between; gap: 16px; border-radius: 20px; background: rgba(255, 255, 255, 0.03); padding: 16px;"
                >
                  <div>
                    <div style="color: #f5f7fb; font-size: 0.94rem; font-weight: 700;">
                      Example Prompts
                    </div>
                    <div
                      style="margin-top: 4px; color: #8e97a8; font-size: 0.84rem; font-weight: 600;"
                    >
                      Include example prompts in a "My Prompts" folder.
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle example prompts"
                    aria-pressed={includeExamplePrompts}
                    onclick={() => (includeExamplePrompts = !includeExamplePrompts)}
                    style={`display: inline-flex; height: 34px; width: 58px; align-items: center; ${
                      includeExamplePrompts ? 'justify-content: flex-end;' : 'justify-content: flex-start;'
                    } border-radius: 999px; border: 1px solid ${
                      includeExamplePrompts ? 'rgba(154, 125, 255, 0.38)' : 'rgba(255, 255, 255, 0.08)'
                    }; background: ${
                      includeExamplePrompts ? 'rgba(113, 86, 215, 0.3)' : 'rgba(255, 255, 255, 0.05)'
                    }; padding: 4px; cursor: pointer;`}
                  >
                    <span
                      style="display: block; height: 24px; width: 24px; border-radius: 999px; background: #f5f7fb; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);"
                    ></span>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  </div>

  {#if dialogState}
    <div
      style="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(2, 3, 7, 0.72); backdrop-filter: blur(10px);"
    >
      <div
        style="width: min(520px, 100%); border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); background: linear-gradient(180deg, rgba(15, 18, 27, 0.98), rgba(8, 10, 16, 0.98)); padding: 28px; box-shadow: 0 28px 70px rgba(0, 0, 0, 0.48);"
      >
        {#if dialogState === 'setup'}
          <div
            style="display: flex; height: 54px; width: 54px; align-items: center; justify-content: center; border-radius: 20px; background: rgba(124, 92, 255, 0.12); color: #d2c3ff;"
          >
            <FolderPlus size={24} />
          </div>
          <h2 style="margin: 20px 0 0; color: #f5f7fb; font-size: 1.34rem; font-weight: 800;">
            Setup Workspace
          </h2>
          <p
            style="margin: 12px 0 0; color: #98a1b3; font-size: 0.95rem; line-height: 1.65; font-weight: 600;"
          >
            This folder doesn't have a Cthulhu Prompt workspace. Would you like to set it up?
            This will create the necessary files and subfolders.
          </p>

          <button
            type="button"
            onclick={() => (includeExamplePrompts = !includeExamplePrompts)}
            style="margin-top: 22px; display: flex; width: 100%; align-items: center; gap: 14px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.03); padding: 16px; color: #d5dbe7; cursor: pointer;"
          >
            <span
              style={`display: inline-flex; height: 22px; width: 22px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 7px; border: 1px solid ${
                includeExamplePrompts ? 'rgba(154, 125, 255, 0.44)' : 'rgba(255, 255, 255, 0.18)'
              }; background: ${
                includeExamplePrompts ? 'rgba(120, 92, 255, 0.22)' : 'transparent'
              }; color: #efeaff;`}
            >
              {#if includeExamplePrompts}
                <Check size={14} />
              {/if}
            </span>
            <span style="text-align: left; font-size: 0.92rem; font-weight: 700;">
              Include example prompts in a "My Prompts" folder.
            </span>
          </button>

          <div style="margin-top: 26px; display: flex; justify-content: flex-end; gap: 12px;">
            {@render dialogButton('Cancel', closeDialog, 'secondary')}
            {@render dialogButton('Setup Workspace', handleSetupWorkspace, 'primary')}
          </div>
        {:else if dialogState === 'existing'}
          <div
            style="display: flex; height: 54px; width: 54px; align-items: center; justify-content: center; border-radius: 20px; background: rgba(124, 92, 255, 0.12); color: #d2c3ff;"
          >
            <FolderOpen size={24} />
          </div>
          <h2 style="margin: 20px 0 0; color: #f5f7fb; font-size: 1.34rem; font-weight: 800;">
            Workspace already exists
          </h2>
          <p
            style="margin: 12px 0 0; color: #98a1b3; font-size: 0.95rem; line-height: 1.65; font-weight: 600;"
          >
            This folder already has a Cthulhu Prompt workspace. Would you like to select it?
          </p>
          <div style="margin-top: 26px; display: flex; justify-content: flex-end; gap: 12px;">
            {@render dialogButton('Cancel', closeDialog, 'secondary')}
            {@render dialogButton('Select Workspace', handleSelectExistingWorkspace, 'primary')}
          </div>
        {:else}
          <div
            style="display: flex; height: 54px; width: 54px; align-items: center; justify-content: center; border-radius: 20px; background: rgba(248, 113, 113, 0.13); color: #ffb8b8;"
          >
            <AlertCircle size={24} />
          </div>
          <h2 style="margin: 20px 0 0; color: #f5f7fb; font-size: 1.34rem; font-weight: 800;">
            Invalid workspace folder
          </h2>
          <p
            style="margin: 12px 0 0; color: #98a1b3; font-size: 0.95rem; line-height: 1.65; font-weight: 600;"
          >
            Select a folder that is not a drive root.
          </p>
          <div style="margin-top: 26px; display: flex; justify-content: flex-end;">
            {@render dialogButton('OK', closeDialog, 'primary')}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</main>
