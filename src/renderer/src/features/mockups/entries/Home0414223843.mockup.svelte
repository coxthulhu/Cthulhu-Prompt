<script lang="ts">
  type Metric = {
    label: string
    value: string
    accent: string
  }

  type ActionCard = {
    eyebrow: string
    title: string
    body: string
    button: string
    buttonStyle: string
  }

  const workspacePath = 'C:\\Users\\Dana\\Documents\\Cthulhu Prompt'

  const metrics: Metric[] = [
    {
      label: 'Prompt Folders',
      value: '18',
      accent:
        'background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.06)); border: 1px solid rgba(196, 181, 253, 0.22);'
    },
    {
      label: 'Prompts',
      value: '247',
      accent:
        'background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04)); border: 1px solid rgba(255, 255, 255, 0.12);'
    }
  ]

  const actionCards: ActionCard[] = [
    {
      eyebrow: 'Open',
      title: 'Select Workspace Folder',
      body: 'Choose an existing workspace folder and continue where you left off.',
      button: 'Select Workspace Folder',
      buttonStyle:
        'background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); color: rgba(250, 250, 250, 0.94); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);'
    },
    {
      eyebrow: 'Create',
      title: 'Create Workspace Folder',
      body: 'Start a new workspace with the required files and folders.',
      button: 'Create Workspace Folder',
      buttonStyle:
        'background: linear-gradient(135deg, rgba(124, 58, 237, 0.34), rgba(91, 33, 182, 0.42)); border: 1px solid rgba(196, 181, 253, 0.34); color: white; box-shadow: 0 18px 30px rgba(76, 29, 149, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.1);'
    }
  ]

  const shellStyle =
    'min-height: 100%; color: rgba(250, 250, 250, 0.96); background: radial-gradient(circle at top, rgba(76, 29, 149, 0.16), transparent 34%), linear-gradient(180deg, #090b10 0%, #0c1016 38%, #090b10 100%); font-family: "Segoe UI", "Inter", sans-serif;'
  const chromeCardStyle =
    'position: relative; overflow: hidden; border-radius: 34px; border: 1px solid rgba(255, 255, 255, 0.09); background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.02)); box-shadow: 0 28px 80px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04);'
  const panelStyle =
    'border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); background: linear-gradient(180deg, rgba(19, 23, 31, 0.96), rgba(13, 16, 22, 0.96)); box-shadow: 0 20px 44px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04);'
  const pillStyle =
    'display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 18px; border-radius: 999px; font-size: 13px; font-weight: 600; letter-spacing: 0.01em;'
</script>

<main data-testid="home-screen-mockup" style={shellStyle}>
  <div
    style="margin: 0 auto; width: min(1180px, calc(100% - 48px)); padding: 44px 0 52px; display: flex; flex-direction: column; gap: 24px;"
  >
    <div
      style={`${chromeCardStyle} padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px;`}
    >
      <div style="display: flex; align-items: center; gap: 14px;">
        <div
          aria-hidden="true"
          style="display: grid; place-items: center; width: 42px; height: 42px; border-radius: 14px; background: linear-gradient(135deg, rgba(109, 40, 217, 0.42), rgba(91, 33, 182, 0.18)); border: 1px solid rgba(196, 181, 253, 0.22); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);"
        >
          <div
            style="width: 18px; height: 18px; border-radius: 6px; border: 1.5px solid rgba(255, 255, 255, 0.9);"
          ></div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <div
            data-testid="home-title"
            style="font-size: 20px; font-weight: 700; letter-spacing: 0.2em;"
          >
            CTHULHU PROMPT
          </div>
          <div style="font-size: 12px; color: rgba(161, 161, 170, 0.92); font-weight: 600;">
            Home
          </div>
        </div>
      </div>

      <div
        style="display: inline-flex; align-items: center; gap: 10px; padding: 0 16px; min-height: 40px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); color: rgba(228, 228, 231, 0.9); font-size: 13px; font-weight: 600;"
      >
        <span
          aria-hidden="true"
          style="width: 9px; height: 9px; border-radius: 999px; background: rgba(167, 139, 250, 0.9); box-shadow: 0 0 16px rgba(167, 139, 250, 0.6);"
        ></span>
        Workspace Ready
      </div>
    </div>

    <section
      style={`${chromeCardStyle} padding: 28px; display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.9fr); gap: 24px;`}
    >
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div style={`${panelStyle} padding: 28px; display: flex; flex-direction: column; gap: 22px;`}>
          <div
            style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap;"
          >
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div
                style="display: inline-flex; align-items: center; width: fit-content; min-height: 32px; padding: 0 12px; border-radius: 999px; background: rgba(139, 92, 246, 0.14); border: 1px solid rgba(196, 181, 253, 0.22); color: rgba(245, 243, 255, 0.94); font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;"
              >
                Current Workspace
              </div>
              <div style="font-size: 33px; line-height: 1.08; font-weight: 700; letter-spacing: -0.03em;">
                Ready to manage prompts
              </div>
              <div
                style="font-size: 14px; line-height: 1.6; color: rgba(161, 161, 170, 0.96); font-weight: 600;"
              >
                Workspace Folder
              </div>
            </div>

            <div
              style="display: grid; gap: 10px; min-width: 180px; padding: 14px; border-radius: 24px; background: rgba(255, 255, 255, 0.035); border: 1px solid rgba(255, 255, 255, 0.08);"
            >
              <div style="font-size: 12px; color: rgba(161, 161, 170, 0.92); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
                Workspace Path
              </div>
              <div
                data-testid="workspace-ready-path"
                title={workspacePath}
                style="padding: 14px 16px; border-radius: 20px; background: rgba(10, 12, 17, 0.95); border: 1px solid rgba(255, 255, 255, 0.08); font-size: 14px; color: rgba(244, 244, 245, 0.94); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
              >
                {workspacePath}
              </div>
            </div>
          </div>

          <div
            style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;"
          >
            {#each metrics as metric (metric.label)}
              <div style={`${metric.accent} border-radius: 26px; padding: 18px 18px 20px; display: grid; gap: 16px;`}>
                <div
                  style="display: flex; align-items: center; justify-content: space-between; gap: 12px;"
                >
                  <div style="font-size: 13px; color: rgba(228, 228, 231, 0.82); font-weight: 700; letter-spacing: 0.03em;">
                    {metric.label}
                  </div>
                  <div
                    aria-hidden="true"
                    style="width: 11px; height: 11px; border-radius: 999px; background: rgba(255, 255, 255, 0.72);"
                  ></div>
                </div>
                <div style="display: flex; align-items: flex-end; gap: 12px;">
                  <div style="font-size: 40px; line-height: 1; font-weight: 700; letter-spacing: -0.04em;">
                    {metric.value}
                  </div>
                  <div
                    style="padding-bottom: 4px; font-size: 12px; color: rgba(161, 161, 170, 0.92); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
                  >
                    Total
                  </div>
                </div>
                <div style="display: flex; gap: 8px;">
                  {#each Array.from({ length: 6 }, (_, barIndex) => barIndex) as barIndex (barIndex)}
                    <div
                      aria-hidden="true"
                      style={`height: 8px; flex: 1; border-radius: 999px; background: ${barIndex < 4 ? 'rgba(255, 255, 255, 0.34)' : 'rgba(255, 255, 255, 0.12)'};`}
                    ></div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 12px;">
            <button type="button" style={`${pillStyle} background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); color: rgba(250, 250, 250, 0.96); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);`}>
              Select Workspace Folder
            </button>
            <button type="button" style={`${pillStyle} background: linear-gradient(135deg, rgba(124, 58, 237, 0.34), rgba(91, 33, 182, 0.42)); border: 1px solid rgba(196, 181, 253, 0.34); color: white; box-shadow: 0 18px 30px rgba(76, 29, 149, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.08);`}>
              Create Workspace Folder
            </button>
            <button type="button" style={`${pillStyle} background: rgba(127, 29, 29, 0.22); border: 1px solid rgba(248, 113, 113, 0.24); color: rgba(254, 202, 202, 0.96); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);`}>
              Close Workspace
            </button>
          </div>
        </div>

        <div
          style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px;"
        >
          <div style={`${panelStyle} padding: 22px; display: grid; gap: 14px;`}>
            <div
              style="font-size: 12px; color: rgba(161, 161, 170, 0.92); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
            >
              New Workspace
            </div>
            <div style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">
              Include Example Prompts
            </div>
            <div
              style="display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 58px; padding: 0 18px; border-radius: 22px; border: 1px solid rgba(196, 181, 253, 0.2); background: rgba(139, 92, 246, 0.08);"
            >
              <span style="font-size: 14px; color: rgba(228, 228, 231, 0.96); font-weight: 600;">
                Include Example Prompts
              </span>
              <div
                style="display: inline-flex; align-items: center; gap: 10px; min-height: 36px; padding: 0 12px; border-radius: 999px; background: rgba(216, 180, 254, 0.18); color: rgba(245, 243, 255, 0.96); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
              >
                <span
                  aria-hidden="true"
                  style="width: 20px; height: 20px; border-radius: 999px; background: rgba(216, 180, 254, 0.86); box-shadow: 0 0 0 4px rgba(216, 180, 254, 0.12);"
                ></span>
                Enabled
              </div>
            </div>
          </div>

          <div style={`${panelStyle} padding: 22px; display: grid; gap: 14px;`}>
            <div
              style="font-size: 12px; color: rgba(161, 161, 170, 0.92); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
            >
              Existing Workspace
            </div>
            <div style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">
              Workspace already exists
            </div>
            <div
              style="padding: 16px 18px; border-radius: 22px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.04); font-size: 14px; line-height: 1.55; color: rgba(161, 161, 170, 0.95); font-weight: 600;"
            >
              Select Workspace
            </div>
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px;">
        {#each actionCards as card (card.title)}
          <div style={`${panelStyle} padding: 22px; display: grid; gap: 16px;`}>
            <div
              style="font-size: 12px; color: rgba(161, 161, 170, 0.9); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
            >
              {card.eyebrow}
            </div>
            <div style="display: grid; gap: 8px;">
              <div style="font-size: 22px; line-height: 1.15; font-weight: 700; letter-spacing: -0.03em;">
                {card.title}
              </div>
              <div
                style="font-size: 14px; line-height: 1.6; color: rgba(161, 161, 170, 0.96); font-weight: 600;"
              >
                {card.body}
              </div>
            </div>
            <button type="button" style={`${pillStyle} justify-content: center; width: 100%; ${card.buttonStyle}`}>
              {card.button}
            </button>
          </div>
        {/each}

        <div style={`${panelStyle} padding: 22px; display: grid; gap: 16px;`}>
          <div
            style="font-size: 12px; color: rgba(161, 161, 170, 0.9); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
          >
            Workspace
          </div>
          <div style="display: grid; gap: 8px;">
            <div style="font-size: 22px; line-height: 1.15; font-weight: 700; letter-spacing: -0.03em;">
              Close Workspace
            </div>
            <div
              style="font-size: 14px; line-height: 1.6; color: rgba(161, 161, 170, 0.96); font-weight: 600;"
            >
              Clear the current workspace and return to Home.
            </div>
          </div>
          <button
            type="button"
            style={`${pillStyle} justify-content: center; width: 100%; background: rgba(127, 29, 29, 0.22); border: 1px solid rgba(248, 113, 113, 0.24); color: rgba(254, 202, 202, 0.96); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);`}
          >
            Close Workspace
          </button>
        </div>
      </div>
    </section>
  </div>
</main>
