Feature: Flutter Casino Full Test

  Full test flow including login and game navigation on Flutter app.

  Scenario: Login and play slots
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I tap "slots_game"
    Then I should see text "MEGA SLOTS"
    When I tap "back_button"
    Then I should see text "Casino Lobby"

  Scenario: Login and play blackjack
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I tap "blackjack_game"
    Then I should see text "BLACKJACK"
    When I tap "back_button"
    Then I should see text "Casino Lobby"



