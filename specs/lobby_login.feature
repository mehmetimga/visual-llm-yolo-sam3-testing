Feature: Lobby Login Smoke Test

  Basic smoke test for login and lobby functionality.
  This scenario should work on both Web and Flutter platforms.

  Scenario: Login and open lobby
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "password123" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    And "join_now_button" should be visible

  Scenario: Navigate to a game from lobby
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "password123" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I tap "slots_game"
    Then I should see text "MEGA SLOTS"
    And "spin_button" should be visible
