Feature: Server sync
  Your data (recipes and ingredients today) is kept on the phone. It can also be synced with your
  own server, to share it between phones: each phone keeps working without it, and catches up when it reaches it.

  Scenario: Data is kept on the phone only at first
    Given the settings are open
    Then my data is kept on this phone only

  Scenario: Connecting to a server merges its recipes with the phone's
    Given the recipe "Leek soup" on this phone
    And the recipe "Pancakes" on the server, from another phone
    And the settings are open
    When I connect to the server with the right account
    Then I am told that the phone is synced with the server
    And the phone has the recipes "Leek soup" and "Pancakes"
    And the server has the recipe "Leek soup"

  Scenario: A wrong password is refused
    Given the settings are open
    When I connect to the server with a wrong password
    Then I am told that the email or password is wrong
    And the phone is not synced with the server

  Scenario: An unreachable server is reported
    Given the phone is synced with the server
    And the server can't be reached
    When I ask for a sync
    Then I am told that the server doesn't answer

  Scenario: A server older than the app is reported
    Given the phone is synced with the server
    And the server lacks the latest server update
    And the recipe "Pie" on this phone
    When I ask for a sync
    Then I am told that the server needs an update
    And the server doesn't have the recipe "Pie"

  Scenario: An app older than the server is asked to update
    Given the phone is synced with the server
    And the server only accepts newer apps
    When I ask for a sync
    Then I am told that the app needs an update

  Scenario: A server newer than the app is pointed out
    Given the phone is synced with the server
    And the server has an update this app doesn't know
    When I ask for a sync
    Then I am told that an app update exists
    And the phone is still synced

  Scenario: Stopping the sync keeps the data
    Given the recipe "Leek soup" on this phone
    And the phone is synced with the server
    When I stop syncing with the server
    Then my data is kept on this phone only
    And the phone has the recipe "Leek soup"
