# [Madness Desktop](https://github.com/MadnessEngineering/madnessDesktop)

[Madness Desktop](https://github.com/MadnessEngineering/madnessDesktop/) is an open-source [Electron](https://www.electronjs.org/)-based
GitHub app built for the madness_interactive workshop ecosystem. It is written in [TypeScript](https://www.typescriptlang.org) and
uses [React](https://reactjs.org/).

<picture>
  <source
    srcset="https://user-images.githubusercontent.com/634063/202742848-63fa1488-6254-49b5-af7c-96a6b50ea8af.png"
    media="(prefers-color-scheme: dark)"
  />
  <img
    width="1072"
    src="https://user-images.githubusercontent.com/634063/202742985-bb3b3b94-8aca-404a-8d8a-fd6a6f030672.png"
    alt="A screenshot of the Madness Desktop application showing changes being viewed and committed with two attributed co-authors"
  />
</picture>

## Where can I get it?

Download the latest build from [GitHub Releases](https://github.com/MadnessEngineering/madnessDesktop/releases).

## What makes it different?

Madness Desktop is a fork of GitHub Desktop enhanced for multi-machine workshop coordination:

- **Hook Loadouts** — install and manage composable git hook scripts per-repository from the UI. Presets for common workflows (MQTT context publishing, secret scanning, auto-pull, todo prefixing).
- **MQTT Integration** — publish git context and events to a shared broker. Any machine on the network sees real-time commit activity from all other machines.
- **Omnispindle Integration** — live todo tracking from the MCP server, visible in the sidebar and injectable into commit messages.
- **PAT sign-in** — use a Personal Access Token instead of the OAuth browser flow.

## Is Madness Desktop right for me? What are the primary areas of focus?

[This document](https://github.com/MadnessEngineering/madnessDesktop/blob/development/docs/process/what-is-desktop.md) describes the focus of Madness Desktop and who the product is most useful for.

## I have a problem with Madness Desktop

Note: The [Madness Desktop Code of Conduct](https://github.com/MadnessEngineering/madnessDesktop/blob/development/CODE_OF_CONDUCT.md) applies in all interactions relating to the Madness Desktop project.

First, please search the [open issues](https://github.com/MadnessEngineering/madnessDesktop/issues?q=is%3Aopen)
and [closed issues](https://github.com/MadnessEngineering/madnessDesktop/issues?q=is%3Aclosed)
to see if your issue hasn't already been reported (it may also be fixed).

There is also a list of [known issues](https://github.com/MadnessEngineering/madnessDesktop/blob/development/docs/known-issues.md)
that are being tracked against Desktop, and some of these issues have workarounds.

If you can't find an issue that matches what you're seeing, open a [new issue](https://github.com/MadnessEngineering/madnessDesktop/issues/new/choose),
choose the right template and provide us with enough information to investigate
further.

## The issue I reported isn't fixed yet. What can I do?

If nobody has responded to your issue in a few days, you're welcome to respond to it with a friendly ping in the issue. Please do not respond more than a second time if nobody has responded. The Madness Desktop maintainers are constrained in time and resources, and diagnosing individual configurations can be difficult and time consuming. While we'll try to at least get you pointed in the right direction, we can't guarantee we'll be able to dig too deeply into any one person's issue.

## How can I contribute to Madness Desktop?

The [CONTRIBUTING.md](./.github/CONTRIBUTING.md) document will help you get setup and
familiar with the source. The [documentation](docs/) folder also contains more
resources relevant to the project.

If you're looking for something to work on, check out the [help wanted](https://github.com/MadnessEngineering/madnessDesktop/issues?q=is%3Aissue+is%3Aopen+label%3A%22help%20wanted%22) label.

## Building Desktop

To setup your development environment for building Desktop, check out: [`setup.md`](./docs/contributing/setup.md).

## More Resources

See [github.com/MadnessEngineering/madnessDesktop](https://github.com/MadnessEngineering/madnessDesktop) for more product-oriented
information about Madness Desktop.

See our [getting started documentation](https://github.com/MadnessEngineering/madnessDesktop/tree/development/docs/overview/getting-started-with-github-desktop) for more information on how to set up, authenticate, and configure Madness Desktop.

## License

**[MIT](LICENSE)**

The MIT license grant is not for GitHub's trademarks, which include the logo
designs. GitHub reserves all trademark and copyright rights in and to all
GitHub trademarks. GitHub's logos include, for instance, the stylized
Invertocat designs that include "logo" in the file title in the following
folder: [logos](app/static/logos).

GitHub® and its stylized versions and the Invertocat mark are GitHub's
Trademarks or registered Trademarks. When using GitHub's logos, be sure to
follow the GitHub [logo guidelines](https://github.com/logos).
