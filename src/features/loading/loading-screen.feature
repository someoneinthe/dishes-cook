Feature: Loading screen
  At startup, the dishes illustration replaces the native splash screen,
  stays on screen for a moment, then fades into the app.

  Scenario: The illustration replaces the native splash screen
    Given the app is starting
    When the loading screen is laid out
    Then the native splash screen is hidden

  Scenario: The app opens once the illustration has been shown
    Given the app is starting
    And the illustration is displayed
    When 1900 milliseconds have passed
    Then the loading screen is finished

  Scenario: The app still opens when the illustration fails to load
    Given the app is starting
    And the illustration fails to load
    When 1900 milliseconds have passed
    Then the loading screen is finished
