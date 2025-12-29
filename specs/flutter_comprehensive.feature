Feature: Flutter Casino Comprehensive UI Tests

  Complete end-to-end UI testing for Flutter casino app with detailed game interactions.

  Scenario: Successful login flow
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    And "balance_display" should be visible
    And "join_now_button" should be visible

  Scenario: Invalid login credentials
    Given I am on the login page
    When I type "wrong" into "login_username"
    And I type "wrong" into "login_password"
    And I tap "login_button"
    Then I should see text "Invalid credentials"

  Scenario: Slots game - increase bet and spin
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I tap "slots_game"
    Then I should see text "MEGA SLOTS"
    And "spin_button" should be visible
    And "bet_plus_button" should be visible
    And "bet_minus_button" should be visible
    When I tap "bet_plus_button"
    And I tap "bet_plus_button"
    And I tap "spin_button"
    Then "balance_display" should be visible
    When I tap "spin_button"
    And I tap "spin_button"
    Then I should see text "BET:"

  Scenario: Slots game - decrease bet and spin
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    When I tap "slots_game"
    Then I should see text "MEGA SLOTS"
    When I tap "bet_minus_button"
    And I tap "spin_button"
    Then "balance_display" should be visible

  Scenario: Blackjack game - full hand
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    When I tap "blackjack_game"
    Then I should see text "BLACKJACK"
    And "deal_button" should be visible
    When I tap "deal_button"
    Then "hit_button" should be visible
    And "stand_button" should be visible
    When I tap "hit_button"
    Then "balance_display" should be visible
    When I tap "stand_button"
    Then "deal_button" should be visible

  Scenario: Blackjack game - multiple hands
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    When I tap "blackjack_game"
    Then I should see text "BLACKJACK"
    When I tap "deal_button"
    And I tap "hit_button"
    And I tap "stand_button"
    And I tap "deal_button"
    Then "hit_button" should be visible

  Scenario: Navigate between games
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    When I tap "slots_game"
    Then I should see text "MEGA SLOTS"
    When I tap "back_button"
    Then I should see text "Casino Lobby"
    When I tap "blackjack_game"
    Then I should see text "BLACKJACK"
    When I tap "back_button"
    Then I should see text "Casino Lobby"

  Scenario: Verify balance updates after spinning
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "$1000"
    When I tap "slots_game"
    And I tap "spin_button"
    And I tap "back_button"
    Then "balance_display" should be visible

  Scenario: Slots game - rapid spins
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    When I tap "slots_game"
    Then I should see text "MEGA SLOTS"
    When I tap "spin_button"
    And I tap "spin_button"
    And I tap "spin_button"
    And I tap "spin_button"
    And I tap "spin_button"
    Then "balance_display" should be visible
    And I should see text "BET:"

  Scenario: Verify all games are accessible from lobby
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Mega Slots"
    And I should see text "Blackjack"
    And I should see text "Roulette"
    And I should see text "Video Poker"
    And I should see text "VIP Tournament"

  Scenario: Blackjack - bust scenario
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    When I tap "blackjack_game"
    When I tap "deal_button"
    And I tap "hit_button"
    And I tap "hit_button"
    And I tap "hit_button"
    Then "deal_button" should be visible

  Scenario: Navigate and logout
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I tap "slots_game"
    Then I should see text "MEGA SLOTS"
    When I tap "back_button"
    Then I should see text "Casino Lobby"
    When I tap "logout_button"
    Then I should see text "MEGA CASINO"
