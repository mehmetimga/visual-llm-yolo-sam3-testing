@flutter @poker
Feature: Poker Session - Play 5 Complete Hands

  Complete poker session: login, play 5 full hands, return to lobby, logout.

  @smoke @full-session
  Scenario: Play 5 complete poker hands then logout
    # === LOGIN ===
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"

    # === NAVIGATE TO POKER TABLE ===
    When I scroll down
    And I scroll down
    Then I should see text "Poker Table"
    When I tap "poker_table_play_button"
    Then I should see text "DEAL"

    # === START GAME - DEAL FIRST HAND ===
    When I tap "deal_button"
    And I wait 2 seconds

    # === HAND 1: Play through all betting rounds ===
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 5 seconds
    # Hand ends - wait for DEAL AGAIN to appear, then click it
    When I wait for "DEAL AGAIN" to appear
    When I tap "deal_again"
    And I wait 2 seconds

    # === HAND 2: Play through all betting rounds ===
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 5 seconds
    # Hand ends - wait for DEAL AGAIN to appear, then click it
    When I wait for "DEAL AGAIN" to appear
    When I tap "deal_again"
    And I wait 2 seconds

    # === HAND 3: Play through all betting rounds ===
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 5 seconds
    # Hand ends - wait for DEAL AGAIN to appear, then click it
    When I wait for "DEAL AGAIN" to appear
    When I tap "deal_again"
    And I wait 2 seconds

    # === HAND 4: Play through all betting rounds ===
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 5 seconds
    # Hand ends - wait for DEAL AGAIN to appear, then click it
    When I wait for "DEAL AGAIN" to appear
    When I tap "deal_again"
    And I wait 2 seconds

    # === HAND 5: Play through all betting rounds ===
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 2 seconds
    When I tap "call_button"
    And I wait 5 seconds
    # Hand 5 ends - wait for DEAL AGAIN to appear (confirms hand ended), then go back
    When I wait for "DEAL AGAIN" to appear

    # === RETURN TO LOBBY ===
    When I tap "back_button"
    And I wait 2 seconds
    Then I should see text "Casino Lobby"

    # === LOGOUT ===
    When I tap "logout_button"
    And I wait 1 seconds
    Then I should see text "Log In"
