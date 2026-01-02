@flutter @lobby
Feature: Casino Lobby - Flutter Mobile

  Tests casino lobby navigation and login on Flutter mobile app.

  @smoke @login
  Scenario: Login to casino lobby
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"

  @navigation
  Scenario: Browse games in lobby
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I scroll down
    Then I should see text "Slots"
    When I scroll down
    Then I should see text "Poker Table"

  @logout
  Scenario: Logout from casino
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I tap "logout_button"
    Then I should see text "Log In"
