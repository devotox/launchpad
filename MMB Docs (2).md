# **Onboarding Guide**

This guide will help you get set up and productive as quickly as possible. It combines essential onboarding steps, team communication info, and tool setup in one place.

---

# **1\. Company-Wide Setup**

## **Google Workspace**

* Ensure you are in the **Manage** and **CX Engineers** teams ([managed via Terraform](https://github.com/loveholidays/terraform-google-workspace/)).  
* See [example PR](https://github.com/loveholidays/terraform-google-workspace/commit/c072bc4de9ec6f1239e8a2bff18f0377bda948f8).

## **GitHub**

* Use your existing GitHub account or create a new one.  
* Request access to the [Developers team](https://github.com/orgs/loveholidays/teams/developers).  
* [Create and authorize an SSH key via SSO](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-an-ssh-key-for-use-with-saml-single-sign-on).  
* [Create and authorize a personal access token](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on) (with \`read:org\` scope).

## **Kubernetes**

* [Set up Kubernetes](https://devportal.lvh.systems/docs/default/component/digital-product-docs/kubernetes/clusters/)

## **NPM**

* [Set up your NPM token](https://devportal.lvh.systems/docs/default/component/digital-product-docs/getting-started/).

## **VPN**

* [Set up VPN access](https://loveholidays.freshservice.com/support/solutions/articles/15000092200-openvpn-setup-guide).

---

# **2\. Communication Channels**

## **Slack Channels**

| Channel Name | Link | Description |
| :---- | :---- | :---- |
| \#mmb-private | [Link](https://loveholidays.slack.com/archives/C05QY3UMY68) | Main team channel |
| \#alerts-mmb-production | [Link](https://loveholidays.slack.com/archives/C052THD0WTH) | System alerts |
| \#mmb-team-dev | [Link](https://loveholidays.slack.com/archives/C018A2TU6CQ) | Tech discussions with other teams |
| \#ask-mmb | [Link](https://loveholidays.slack.com/archives/C014GLMT3BM) | Enquiries from people out of our team |
| \#update-mmb | [Link](https://loveholidays.slack.com/archives/C08MWGYPH0T) | MMB team-wide updates |

## **Readings**

* [Our principles](https://app.clickup.com/2658768/docs/2h4eg-12228/2h4eg-14348)  
* [Incident management](https://app.clickup.com/2658768/docs/2h4eg-12228/2h4eg-15528)  
* [Interview](https://app.clickup.com/2658768/docs/2h4eg-12228/2h4eg-15768)  
* [Digital product documentation](https://devportal.lvh.systems/catalog/default/component/digital-product-docs/docs/getting-started/)  
* [Digital product onboarding](https://app.clickup.com/2658768/v/dc/2h4eg-12228/2h4eg-15988)  
* [Frontier](https://app.clickup.com/2658768/v/dc/2h4eg-54972/2h4eg-20208)

---

# **3\. Main Things We Own**

You can find everything we own on [devportal](https://devportal.lvh.systems/catalog/default/group/mmb). How to run these applications should be in their respective README files. Aurora and Frontier are the main applications we work on, aiming to replace legacy systems.

---

# **4\. Tools**

## **Product & Data Tools**

* ## [Twilio](https://console.twilio.com/) – SMS verification for customer bookings

* ## [Delighted](https://app.delighted.com/dashboard) – CSAT and CES for product assessment

* ## [Sanity](https://loveholidays.sanity.studio/staging/desk/configuration;contactCenter) – CMS platform

* ## [Rudderstack](https://app.rudderstack.com/login) – Data collection (often stored in BigQuery)

* ## [Looker](https://looker.com/) – Business intelligence and analytics platform

  * ## [MMB KPI Dashboard](https://loveholidays.cloud.looker.com/dashboards/1027)

  * ## [Self Serve Automation](https://loveholidays.cloud.looker.com/x/sw5uZk2ByhuaN1IGnmGHUx)

* ## [Looker Studio](https://lookerstudio.google.com/) – Data visualization and dashboarding tool

  * ## [Step Conversion Funnel Metrics](https://www.google.com/search?q=https://lookerstudio.google.com/u/0/reporting/3905a19c-3a2b-488e-a83c-324338a4031d/page/p_mqh4oodyqd)

  * ## [Customer Feedback](https://www.google.com/search?q=https://lookerstudio.google.com/u/0/reporting/3905a19c-3a2b-488e-a83c-324338a4031d/page/p_3hx8n5fdqd)

* ## [Grafana](https://grafana.lvh.systems/) – Monitoring and observability dashboards

  * ## [MMB Dashboard](https://grafana.lvh.systems/d/f45f5d89-8dab-4a18-b122-8c795928b024/mmb-dashboard?orgId=1&from=now-1h&to=now&timezone=browser&var-AMENDMENT_JOURNEYS_TRACKING_INTERVAL=10m)

  * ## [Payment Service Dashboards](https://grafana.lvh.systems/d/payment-service/payment-service?orgId=1&from=now-1h&to=now&timezone=browser&var-interval=1m)

* ## [Fullstory](https://app.fullstory.com/) – Session replay and analytics

  * [MMB \- Passenger Automated Flow](https://app.fullstory.com/ui/PEFTQ/segments/ODPzystOHmZ3/people:search?completeSessions=false)  
  * You can create your own segments [here](https://app.fullstory.com/ui/PEFTQ/segments/everyone/people:search?create=true&completeSessions=false) using URLs from MMB  
  * You can use the search bar on the homepage to look if there are segments created already, e.g. “MMB:...”

##  Software We Use

* **Figma**: UI/UX design   
  * [Discovery](https://www.figma.com/files/867798274506041043/project/80520177/%F0%9F%94%8E-Discovery?fuid=1154027614465974682) – design explorations and iterations  
  * [Delivery](https://www.figma.com/files/867798274506041043/project/15881012/%F0%9F%93%A6-Delivery?fuid=1154027614465974682) – final design solutions ready for implementation  
  * [MMB Research](https://drive.google.com/drive/folders/1-lXViJa-oFJyUaZRow3x0nMYr2us8U7U?usp=drive_link) – qualitative research plans and outcomes  
* **Docker Desktop**: Containers  
* **ClickUp**: Project management  
* **Lens**: Kubernetes IDE ([setup guide](https://devportal.lvh.systems/docs/default/component/digital-product-docs/kubernetes/lens/))  
* **ngrok**: Localhost tunneling  
* **Google Cloud SDK**: GCP CLI tools  
* **Terminal Options**:  
  * [iTerm2](https://iterm2.com/) – Enhanced terminal with features like split panes, search, and more.  
  * [Alacritty](https://alacritty.org/) – Fast, GPU-accelerated terminal emulator.  
  * [Kitty](https://sw.kovidgoyal.net/kitty/) – GPU-based terminal with advanced features.  
  * [Terminal (default Mac)](https://support.apple.com/guide/terminal/welcome/mac) – Pre-installed, simple and reliable.  
* **API Clients**:  
  * [Bruno](https://www.usebruno.com/)  
  * [Postman](https://www.postman.com/)  
  * [Insomnia](https://insomnia.rest/)

---

# **5\. MacOS Environment Setup**

## **5.1. Install Xcode Command Line Tools**

```shell
xcode-select --install 
# Follow the prompts to complete installation.
```

## **5.2. Install Package Managers**

* Install [Homebrew](https://brew.sh/)   
* Install Node / NPM (choose one version manager):  
  * [NVM](https://github.com/nvm-sh/nvm)  
  * [Volta](https://volta.sh/)  
  * [ASDF](https://asdf-vm.com/)  
* Install [PNPM](https://pnpm.io/) globally

## **5.3. Install Essential Software**

```shell
brew install ngrok
brew install --cask figma docker lens google-cloud-sdk

# Choose a terminal (all are optional, Mac Terminal is pre-installed):
brew install --cask iterm2      # Enhanced terminal with features like split panes
# brew install --cask alacritty  # GPU-accelerated terminal
# brew install --cask kitty      # GPU-accelerated terminal with advanced features
# (Mac Terminal is pre-installed)

# Choose one API client:
brew install --cask bruno      # Open source, Git integration
# brew install --cask postman  # Industry standard
# brew install --cask insomnia # Lightweight, GraphQL support
```

---

# **6\. Main Repositories**

* **Aurora** (Backend): [GitHub](https://github.com/loveholidays/aurora)  
  * See \`README.md\` for setup.  
* **Frontier** (Frontend): [GitHub](https://github.com/loveholidays/webmono)  
  * See \`projects/frontier/README.md\` for setup.  
* **MMB Monorepo** (Backend): [Github](https://github.com/loveholidays/mmb)  
  * See \`README.md\` for setup.

---

# **7\. Troubleshooting**

## **Repository Access**

1. Confirm you're in the [Developers team](https://github.com/orgs/loveholidays/teams/developers).  
2. Check your SSH key:

```shell
ssh -T git@github.com
```

3. Ensure your personal access token is valid and has the correct scopes.  
4. If issues persist, [open a Freshservice ticket](https://loveholidays.freshservice.com/support/tickets/new) with error messages and screenshots.

## **403 Errors**

* Confirm you're in the correct [Google Workspace groups](https://github.com/loveholidays/terraform-google-workspace/).  
* Ensure your [NPM token](https://devportal.lvh.systems/docs/default/component/digital-product-docs/getting-started/) is set up.  
* If issues persist, [open a Freshservice ticket](https://loveholidays.freshservice.com/support/tickets/new).

## **VPN Access**

* Ensure VPN is set up if working remotely. See the [OpenVPN setup guide](https://loveholidays.freshservice.com/support/solutions/articles/15000092200-openvpn-setup-guide).

---

# **8\. Need Help?**

* If you're stuck, reach out to your lead engineer or open a [Freshservice ticket](https://loveholidays.freshservice.com/support/tickets/new).

---

**Tip:** Keep this document handy for reference during your first weeks\!