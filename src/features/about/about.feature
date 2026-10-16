Feature: About
  The About page, in the menu, tells how the app handles your data: what
  stays on the device, what goes to your own sync server if you set one up,
  and that nothing is sent to anyone else. It also shows the app's version.

  Scenario: The About page tells where my data goes
    When I open the About page
    Then I read what stays on this device
    And I read what goes to my own server, only if I choose to sync with it
    And I read that nothing is sent to anyone else
    And I see the app's version

  Scenario: The About page speaks my language
    Given the app is in French
    When I open the About page
    Then I read "Sur cet appareil"

