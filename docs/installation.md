# Installing Madness Desktop

Madness Desktop currently supports Windows 7 (or higher) and macOS 10.9 (or higher).

### macOS

Download the `Madness Desktop.zip`, unpack the application and put it wherever you want.

### Windows

On Windows you have two options:

 - Download the `MadnessDesktopSetup.exe` and run it to install it for the current user.
 - Download the `MadnessDesktopSetup.msi` and run it to install a machine-wide version of Madness Desktop - each logged-in user will then be able to run Madness Desktop from the program at `%PROGRAMFILES(x86)\Madness Desktop Installer\desktop.exe`.

## Data Directories

Madness Desktop will create directories to manage the files and data it needs to function. If you manage a network of computers and want to install Madness Desktop, here is more information about how things work.

### macOS
 - `~/Library/Application Support/Madness Desktop/` - this directory contains user-specific data which the application requires to run, and is created on launch if it doesn't exist. Log files are also stored in this location.

### Windows

 - `%LOCALAPPDATA%\MadnessDesktop\` - contains the latest versions of the app, and some older versions if the user has updated from a previous version.
 - `%APPDATA%\Madness Desktop\` - this directory contains user-specific data which the application requires to run, and is created on launch if it doesn't exist. Log files are also stored in this location.

## Log Files

Madness Desktop will generate logs as part of its normal usage, to assist with troubleshooting. They are located in the data directory that Madness Desktop uses (see above) under a `logs` subdirectory, organized by date using the format `YYYY-MM-DD.desktop.production.log`, where `YYYY-MM-DD` is the day the log was created.

## Installer Logs

Problems with installing or updating Madness Desktop are tracked in a separate file which is managed by the updater frameworks used in the app.

### macOS

 - `~/Library/Caches/com.madnessengineering.MadnessDesktop.ShipIt/ShipIt_stderr.log` - this file will contain details about why the installation or update failed - check the end of the file for recent activity.

### Windows

 - `%LOCALAPPDATA%\MadnessDesktop\SquirrelSetup.log` - this file will contain details about update attempts for Madness Desktop after it's been successfully installed.
 - `%LOCALAPPDATA%\SquirrelSetup.log` - information about the initial installation may be found here. As this framework is used by different apps, it may also contain details about other apps. Ensure that you focus on mentions of `MadnessDesktop.exe` in the log.
